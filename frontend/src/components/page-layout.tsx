import * as React from "react"

interface PageLayoutProps {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}

export function PageLayout({ title, description, children, action }: PageLayoutProps) {
  return (
    <div className="w-full px-6 py-8 lg:px-12">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="flex flex-col gap-6">
        {children}
      </div>
    </div>
  )
}
