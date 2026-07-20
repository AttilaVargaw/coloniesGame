import { ShapeComponent } from "./ShapeComponent";

export class HexagonComponent extends ShapeComponent {
    constructor(radius: number) {
        super(6, radius);
    }
}
