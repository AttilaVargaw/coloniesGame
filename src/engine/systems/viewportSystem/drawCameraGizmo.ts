import Camera from "@/lib/camera";
import { TWO_PI } from "@/game/constants";

export function drawCameraGizmo(ctx: CanvasRenderingContext2D, camera: Camera) {
    const size = 50;
    const padding = 20;
    const cx = camera.cssWidth - size - padding;
    const cy = camera.cssHeight - size - padding;
    const axisLength = size * 0.7;

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, TWO_PI);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, size, 0, TWO_PI);
    ctx.stroke();

    const { rx, ry, ux, uy, fx, fy } = camera.viewBasis;

    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctx.strokeStyle = "rgba(255, 0, 0, 0.9)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + rx * axisLength, cy - ry * axisLength);
    ctx.stroke();

    ctx.strokeStyle = "rgba(0, 255, 0, 0.9)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + ux * axisLength, cy - uy * axisLength);
    ctx.stroke();

    ctx.strokeStyle = "rgba(0, 100, 255, 0.9)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + fx * axisLength, cy - fy * axisLength);
    ctx.stroke();

    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const labelOffset = axisLength + 8;
    ctx.fillText("R", cx + rx * labelOffset, cy - ry * labelOffset);
    ctx.fillText("U", cx + ux * labelOffset, cy - uy * labelOffset);
    ctx.fillText("F", cx + fx * labelOffset, cy - fy * labelOffset);

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const coordX = cx - size - 12;
    const lookAt = camera.lookAt;
    ctx.fillText(`(${lookAt[0].toFixed(1)}, ${lookAt[1].toFixed(1)}, ${lookAt[2].toFixed(1)}) pitch: ${camera.pitch.toFixed(2)} yaw: ${camera.yaw.toFixed(2)}`, coordX, cy);

    ctx.restore();
}

export function drawCameraTarget(ctx: CanvasRenderingContext2D, camera: Camera) {
    const projected = camera.project(camera.lookAt[0], camera.lookAt[1], camera.lookAt[2])
    if(!projected) return

    ctx.save()
    ctx.strokeStyle = "rgba(255, 255, 0, 0.9)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(projected.x, projected.y, 6, 0, TWO_PI)
    ctx.stroke()
    ctx.restore()
}
