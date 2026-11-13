import { LucideProps } from "lucide-react"
import { ComponentType } from "react"

export function renderMappedIcon<T extends string>(
  iconMap: Record<T, ComponentType<LucideProps>>,
  name: T,
  className?: string,
) {
  const IconComponent = iconMap[name] as ComponentType<LucideProps>

  if (!IconComponent) {
    return name
  }

  return <IconComponent className={className} strokeWidth={1.5} size={16} />
}
