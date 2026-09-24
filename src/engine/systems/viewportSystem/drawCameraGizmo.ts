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

    const { rx, ry, ux, uy, fx, fy, } = camera.viewBasis;

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
    ctx.fillText("X", cx + rx * labelOffset, cy - ry * labelOffset);
    ctx.fillText("Y", cx + ux * labelOffset, cy - uy * labelOffset);
    ctx.fillText("Z", cx + fx * labelOffset, cy - fy * labelOffset);

    ctx.restore();
}
