import { EntityComponent } from "@/ems/entities/entityComponent";
import Camera from "@/lib/camera";

export class ViewportComponent extends EntityComponent {
    constructor(public camera: Camera) {
        super()
    }
}