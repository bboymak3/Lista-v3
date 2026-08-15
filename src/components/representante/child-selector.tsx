'use client'

import { useRepresentanteStore, type Child } from '@/stores/representante-store'
import { cn } from '@/lib/utils'
import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function childLabel(c: Child): string {
  return `${c.nombre} ${c.apellido}`
}

function childInitials(c: Child): string {
  return `${c.nombre?.[0] || ''}${c.apellido?.[0] || ''}`.toUpperCase()
}

export function ChildSelector({ className }: { className?: string }) {
  const children = useRepresentanteStore((s) => s.children)
  const selectedChildId = useRepresentanteStore((s) => s.selectedChildId)
  const selectChild = useRepresentanteStore((s) => s.selectChild)

  if (children.length === 0) return null
  if (children.length === 1) {
    const c = children[0]
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-xl border bg-card',
          className
        )}
      >
        <Avatar className="w-10 h-10">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-sm font-semibold">
            {childInitials(c)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-semibold truncate">{childLabel(c)}</p>
          <p className="text-xs text-muted-foreground truncate">
            {c.section.nombre} · {c.section.plantel.nombre}
          </p>
        </div>
      </div>
    )
  }

  const selected =
    children.find((c) => c.id === selectedChildId) || children[0]

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-sm font-medium text-muted-foreground hidden sm:block">
        Hijo/a:
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="justify-between min-w-[200px]">
            <span className="flex items-center gap-2 min-w-0">
              <Avatar className="w-6 h-6">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px] font-semibold">
                  {childInitials(selected)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{childLabel(selected)}</span>
            </span>
            <ChevronDown className="w-4 h-4 opacity-50 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Seleccionar hijo/a</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {children.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onClick={() => selectChild(c.id)}
              className="cursor-pointer"
            >
              <Avatar className="w-7 h-7 mr-2">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-xs font-semibold">
                  {childInitials(c)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{childLabel(c)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {c.section.nombre}
                </p>
              </div>
              {c.id === selectedChildId && (
                <Check className="w-4 h-4 text-emerald-600 ml-2" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
