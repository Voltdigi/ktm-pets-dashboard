"use client"

import { useMemo, useState } from "react"

export interface SortOption<T> {
  value: string
  label: string
  compare: (a: T, b: T) => number
}

export interface UseListControlsOptions<T> {
  data: T[]
  getSearchableValues: (item: T) => Array<string | number | null | undefined>
  sortOptions: SortOption<T>[]
  defaultSortValue: string
  /** Omit entirely for pages with no filter dropdown. */
  getFilterValue?: (item: T) => string
}

export function useListControls<T>({
  data,
  getSearchableValues,
  sortOptions,
  defaultSortValue,
  getFilterValue,
}: UseListControlsOptions<T>) {
  const [search, setSearch] = useState("")
  const [filterValue, setFilterValue] = useState("all")
  const [sortValue, setSortValue] = useState(defaultSortValue)

  const filteredData = useMemo(() => {
    let result = data

    if (getFilterValue && filterValue !== "all") {
      result = result.filter((item) => getFilterValue(item) === filterValue)
    }

    const query = search.trim().toLowerCase()
    if (query) {
      result = result.filter((item) =>
        getSearchableValues(item).some(
          (value) => value !== null && value !== undefined && String(value).toLowerCase().includes(query)
        )
      )
    }

    const activeSort = sortOptions.find((option) => option.value === sortValue)
    if (activeSort) {
      result = [...result].sort(activeSort.compare)
    }

    return result
  }, [data, search, filterValue, sortValue, sortOptions, getFilterValue, getSearchableValues])

  return {
    search,
    setSearch,
    filterValue,
    setFilterValue,
    sortValue,
    setSortValue,
    filteredData,
  }
}
