// import { PositionComponent } from "../components/position";
// import { Engine } from "../engine";
// import { Entity } from "../entities/entity";
// import { EntityNode } from "../entities/entityNode";
// import { System } from "./system";

// // function Rotate([x, y, z]: [number, number, number]) {
// //     return [-z, -x, -y]
// // }

// class OrbitComponent {
//     readonly maxPhase

//     constructor(public radius: number, public phase: number) {
//         this.maxPhase = radius * 6 - 1
//     }
// }

// class OrbitNode extends EntityNode {
//     constructor(public orbit: OrbitComponent, public position: PositionComponent, parent: Entity) {
//         super(parent)
//     }
// }

// export class MoveSystem extends System {
//     nodes = [] as OrbitNode[]

//     update(_dt: number): void {

//     }

//     addToEngine(engine: World) {
//         this.nodes = engine.getNodeList(OrbitNode)

//         const onDayPassed = () => {

//         }

//         engine.subscribe("dayPassed", onDayPassed)

//         return () => {
//             engine.unsubscribe("dayPassed", onDayPassed)
//         }
//     }
// }
