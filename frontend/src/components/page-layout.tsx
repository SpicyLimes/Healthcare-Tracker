import * as React from "react"

interface PageLayoutProps {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
}

export function PageLayout({ title, description, children, action }: PageLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start justify-between gap-4">
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
      {children}
    </div>
  )
}
