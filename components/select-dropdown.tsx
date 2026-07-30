"use client"

import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SelectDropdownOption {
  value: string
  label: string
}

interface SelectDropdownProps {
  value: string
  onValueChange: (value: string) => void
  options: SelectDropdownOption[]
  placeholder?: string
  className?: string
}

export function SelectDropdown({
  value,
  onValueChange,
  options,
  placeholder,
  className,
}: SelectDropdownProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as string)}>
      <SelectTrigger className={cn("min-w-56", className)} size="sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
