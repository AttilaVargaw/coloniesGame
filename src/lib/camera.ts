/**
 * Camera by @robashton returns Camera object.
 *  constructor initial parameters:
 *  @param {context} str *required 
 *  @param {settings} str *optional
  */
export default class Camera {
    distance: number;
    lookAt: [number, number];
    minDistance: number;
    maxDistance: number;
    private fieldOfView: number;
    private viewport: { left: number; right: number; top: number; bottom: number; width: number; height: number; scale: [number, number]; };
    private aspectRatio: number = 1.0;

    constructor(public context: CanvasRenderingContext2D, settings = {
        distance: 1000.0,
        initialPosition: [0, 0] as [number, number],
        fieldOfView: Math.PI / 4.0,
        scaleX: 1.0,
        scaleY: 1.0,
        minDistance: 100.0,
        maxDistance: 12000.0,
    }) {
        this.distance = settings.distance;
        this.minDistance = settings.minDistance;
        this.maxDistance = settings.maxDistance;
        this.lookAt = settings.initialPosition;
        this.context = context;
        this.fieldOfView = settings.fieldOfView;
        this.viewport = {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            width: 0,
            height: 0,
            scale: [settings.scaleX || 1.0, settings.scaleY || 1.0]
        };
        this.init();
    }

    /**
     * Camera Initialization
     * -Add listeners.
     * -Initial calculations.
     */
    private init() {
        this.addListeners();
        this.updateViewport();
    }

    /**
     * Applies to canvas context the parameters:
     *  -Scale
     *  -Translation
     */
    begin() {
        this.context.save();
        this.applyScale();
        this.applyTranslation();
    }

    /**
     * 2d Context restore() method
     */
    end() {
        this.context.restore();
    }

    /**
     * 2d Context scale(Camera.viewport.scale[0], Camera.viewport.scale[0]) method
     */
    private applyScale() {
        this.context.scale(this.viewport.scale[0], this.viewport.scale[1]);
    }

    /**
     * 2d Context translate(-Camera.viewport.left, -Camera.viewport.top) method
     */
    private applyTranslation() {
        this.context.translate(-this.viewport.left, -this.viewport.top);
    }

    /**
     * Camera.viewport data update
     */
    private updateViewport() {
        this.aspectRatio = this.context.canvas.width / this.context.canvas.height;
        this.viewport.width = this.distance * Math.tan(this.fieldOfView);
        this.viewport.height = this.viewport.width / this.aspectRatio;
        this.viewport.left = this.lookAt[0] - (this.viewport.width / 2.0);
        this.viewport.top = this.lookAt[1] - (this.viewport.height / 2.0);
        this.viewport.right = this.viewport.left + this.viewport.width;
        this.viewport.bottom = this.viewport.top + this.viewport.height;
        this.viewport.scale[0] = this.context.canvas.width / this.viewport.width;
        this.viewport.scale[1] = this.context.canvas.height / this.viewport.height;
    }

    /**
     * Zooms to certain z distance, clamped to the configured bounds.
     * @param {*z distance} z 
     */
    public zoomTo(z: number) {
        this.distance = Math.min(this.maxDistance, Math.max(this.minDistance, z));
        this.updateViewport();
    }

    /**
     * Zoom while keeping the world point currently under (screenX, screenY) fixed.
     * Used so the map grows/shrinks around the cursor instead of the world origin.
     * @param {target z distance} z 
     * @param {screen-space x relative to the canvas} screenX 
     * @param {screen-space y relative to the canvas} screenY 
     */
    public zoomToAnchored(z: number, screenX: number, screenY: number) {
        const before = this.screenToWorld(screenX, screenY);
        this.zoomTo(z);
        const after = this.screenToWorld(screenX, screenY);
        this.moveTo(
            this.lookAt[0] + (before.x - after.x),
            this.lookAt[1] + (before.y - after.y)
        );
    }

    /**
     * Multiplicative zoom (smooth, frame-rate independent feel). 1 = no change.
     * @param {zoom factor} factor 
     * @param {screen-space x relative to the canvas} screenX 
     * @param {screen-space y relative to the canvas} screenY 
     */
    public zoomBy(factor: number, screenX: number, screenY: number) {
        this.zoomToAnchored(this.distance * factor, screenX, screenY);
    }

    /**
     * Moves the centre of the viewport by a pixel delta in screen space, converting
     * it to world space using the current viewport scale. Subtracts because dragging
     * right should move the world right / camera left (point under cursor stays fixed).
     * @param {pixel delta on x axis} dxPixels
     * @param {pixel delta on y axis} dyPixels
     */
    public panByPixels(dxPixels: number, dyPixels: number) {
        const worldDeltaX = dxPixels / this.viewport.scale[0];
        const worldDeltaY = dyPixels / this.viewport.scale[1];
        this.moveTo(this.lookAt[0] - worldDeltaX, this.lookAt[1] - worldDeltaY);
    }

    /**
     * Moves the centre of the viewport to new x, y coords (updates Camera.lookAt)
     * @param {x axis coord} x 
     * @param {y axis coord} y 
     */
    moveTo(x: number, y: number) {
        this.lookAt[0] = x;
        this.lookAt[1] = y;
        this.updateViewport();
    }
    /**
     * Transform a coordinate pair from screen coordinates (relative to the canvas) into world coordinates (useful for intersection between mouse and entities)
     * Optional: obj can supply an object to be populated with the x/y (for object-reuse in garbage collection efficient code)
     * @param {x axis coord} x 
     * @param {y axis coord} y 
     * @param {obj can supply an object to be populated with the x/y} obj 
     * @returns 
     */
    /**
     * Visible world-space rectangle (left/right/top/bottom).
     * Useful for culling entities outside the viewport.
     */
    public get visibleBounds() {
        return {
            left: this.viewport.left,
            right: this.viewport.right,
            top: this.viewport.top,
            bottom: this.viewport.bottom,
        };
    }

    public screenToWorld(x: number, y: number, obj?: any) {
        obj = obj || {};
        obj.x = (x / this.viewport.scale[0]) + this.viewport.left;
        obj.y = (y / this.viewport.scale[1]) + this.viewport.top;
        return obj as { x: number, y: number };
    }

    /**
     * Transform a coordinate pair from world coordinates into screen coordinates (relative to the canvas) - useful for placing DOM elements over the scene.
     * Optional: obj can supply an object to be populated with the x/y (for object-reuse in garbage collection efficient code).
     * @param {x axis coord} x 
     * @param {y axis coord} y  
     * @param {obj can supply an object to be populated with the x/y} obj 
     * @returns 
     */
    public worldToScreen(x: number, y: number, obj?: any) {
        obj = obj || {};
        obj.x = (x - this.viewport.left) * (this.viewport.scale[0]);
        obj.y = (y - this.viewport.top) * (this.viewport.scale[1]);
        return obj;
    }

    /**
     * Event Listeners for:
     *  -Zoom and scroll around world
     *  -Center camera on "R" key
     */
    private addListeners() {
        // window.onwheel = e => {
        //     if(e.ctrlKey) {
        //         // Your zoom/scale factor
        //         let zoomLevel = this.distance - (e.deltaY * 20);
        //         if(zoomLevel <= 1) {
        //             zoomLevel = 1;
        //         }

        //         this.zoomTo(zoomLevel);
        //     } else {
        //         // Your track-pad X and Y positions
        //         const x = this.lookAt[0] + (e.deltaX * 2);
        //         const y = this.lookAt[1] + (e.deltaY * 2);

        //         this.moveTo(x, y);
        //     }
        // };

        // window.addEventListener('keydown', e => {
        //     if(e.key === 'r') {
        //         this.zoomTo(1000);
        //         this.moveTo(0, 0);
        //     }
        // });

        return this;
    }
};