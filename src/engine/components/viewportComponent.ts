import { EntityComponent } from "@engine/entities/entityComponent";
import Camera from "@/lib/camera";

export class ViewportComponent extends EntityComponent {
    constructor(public camera: Camera) {
        super()
    }
}