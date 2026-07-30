"use client"

import { RiSearchLine, RiCloseLine } from "@remixicon/react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({ value, onChange, placeholder = "Search...", className }: SearchInputProps) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <RiSearchLine className="w-4 h-4" />
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" onClick={() => onChange("")} aria-label="Clear search">
            <RiCloseLine className="w-4 h-4" />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
