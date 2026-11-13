"use client"

import { Tabs, TabsList } from "../ui/tabs"
import { ReactNode } from "react"

export function GameDialogTabs({
  triggers,
  children,
}: {
  triggers: ReactNode
  children: ReactNode
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList style={{ height: "2em", width: "100%" }}>
        {triggers}
      </TabsList>
      <div style={{
        height: "calc(75vh - 2em)",
        overflowY: "auto",
        padding: "1em",
      }}>
        {children}
      </div>
    </Tabs>
  )
}
