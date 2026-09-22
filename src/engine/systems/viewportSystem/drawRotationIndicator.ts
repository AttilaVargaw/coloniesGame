import Camera from "@/lib/camera";

export const rotationIndicatorColor = "rgba(255, 255, 255, 0.2)";

export function drawRotationIndicator(ctx: CanvasRenderingContext2D, camera: Camera) {
    ctx.save();
    ctx.strokeStyle = rotationIndicatorColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(camera.cssWidth / 2, camera.cssHeight / 2, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(camera.cssWidth / 2 - 6, camera.cssHeight / 2);
    ctx.lineTo(camera.cssWidth / 2 + 6, camera.cssHeight / 2);
    ctx.moveTo(camera.cssWidth / 2, camera.cssHeight / 2 - 6);
    ctx.lineTo(camera.cssWidth / 2, camera.cssHeight / 2 + 6);
    ctx.stroke();
    ctx.restore();
}
