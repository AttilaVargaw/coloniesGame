import { System } from "@engine/systems/system"
import { TextureComponent } from "@engine/components/textureComponent"
import { RotationComponent } from "@/game/components/rotationComponent"

export class AsteroidSpinSystem extends System {
    update(dt: number): void {
        if(!this.engine) return

        for(const entity of this.engine.getAllEntities()) {
            const rotation = entity.getComponent(RotationComponent)
            const texture = entity.getComponent(TextureComponent)
            if(rotation && texture) {
                rotation.angle += rotation.speed * (dt / 1000)
                texture.rotation = rotation.angle % (Math.PI * 2)
            }
        }
    }
}
