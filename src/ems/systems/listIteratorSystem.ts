// import { Engine } from "@/src/ems/engine";
// import { LabelComponent } from "../components/label";
// import { PositionComponent } from "../components/position";
// import { System } from "./system";


// export class ListIteratorSystem<TNode> implements System {
//     readonly name = "LabelRenderer";

//     nodes: TNode[] = [];

//     addToEngine(engine: Engine): void {
//         engine.registerNodeType(this.constructor.name,
//             new Set([
//                 PositionComponent,
//                 LabelComponent
//             ]),
//             (components) => {
//                 return {
//                     position: components.get(PositionComponent),
//                     label: components.get(LabelComponent)
//                 }
//             });
//         this.nodes = engine.getNodeList(this.constructor.name) as TNode[];
//     }

//     update(dt: number): void {
//         this.nodes.forEach(update)
//     }
// } 