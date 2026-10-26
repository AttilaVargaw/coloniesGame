import { getPlatform } from "@/engine/lib/platform";
import { IndustryComponent } from "@/game/components/industryComponent";
import { techs, TECHS, techTypes } from "@/game/data/Techs";
import { useGameEngine } from "@/hooks/useGameContext";
import { JSX, useEffect, useMemo, useRef, useState } from "react";

const radius = 40
const breakPercent = 18
// const width = 180

const starterTech = new Set<string>(Object.entries(techs)
    .filter(([_, tech]) => !tech.prerequisites || tech.prerequisites.size === 0)
    .map(([techId, _]) => techId));

export function Research(_: { industry: IndustryComponent }) {
    const [width, setWidth] = useState(0)
    const svgRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        const resizeEventListener = () => {
            if(svgRef.current) {
                setWidth(svgRef.current.clientWidth / 3 || 0)
                console.log(svgRef.current?.clientWidth / 3)
            }
        }

        resizeEventListener()

        getPlatform().window.addEventListener("resize", resizeEventListener)

        return () => {
            getPlatform().window.removeEventListener("resize", resizeEventListener)
        }
    }, [])

    let level = 0

    const items = useMemo(() => {
        let elements = starterTech
        const ret = [] as JSX.Element[]

        while(elements.size > 0) {
            [...elements].forEach((techId, i) => {
                ret.push(<g transform={`translate(${i * (width + 12)} ${50 * level})`} key={techId} style={{ cursor: "pointer" }}>
                    <rect style={{
                        clipPath: `polygon(${breakPercent}px 0, calc(100% - ${breakPercent}px) 0, 100% ${breakPercent}px, 100% calc(100% - ${breakPercent}px), calc(100% - ${breakPercent}px) 100%, ${breakPercent}px 100%, 0 calc(100% - ${breakPercent}px), 0 ${breakPercent}px)`
                    }} x="0" y="0" height={48} width={200} stroke="black" strokeWidth="3" fill="whitesmoke" onClick={(e) => console.log(techId)} />
                    <text fontFamily="Chronosfer" fill="black" dominantBaseline="middle" alignmentBaseline="mathematical" textAnchor="middle" y={radius / 2} x={width / 2} fontSize="18">{techs[techId].name}</text>
                </g>)

            })
            elements = [...elements].reduce((prev, element) => {
                const items2 = [...TECHS].filter(([, { prerequisites }]) => prerequisites?.has(element)).map(([techId, _]) => techId)

                if(items2.length) {
                    prev = prev.union(new Set(items2))
                }

                return prev
            }, new Set<string>())
            level++
        }

        return ret
    }, [])

    return <div className="space-y-4 overflow-x-auto px-2" style={{ height: "70vh" }}>
        <h2 className="text-xl font-bold flex">State sponsored research</h2>
        <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" className="w-max" style={{ width: "100%", height: "100%" }}>
            {items}
        </svg>
    </div >
}