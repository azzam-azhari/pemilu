"use client"

import * as React from "react"
import { format, isValid, parse } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const VALUE_FORMAT = "yyyy-MM-dd"

/** Ubah string "yyyy-MM-dd" menjadi Date lokal (tanpa pergeseran zona waktu). */
function toDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined
  const d = parse(value, VALUE_FORMAT, new Date())
  return isValid(d) ? d : undefined
}

type DatePickerProps = {
  id?: string
  /** Nilai dalam format "yyyy-MM-dd"; string kosong berarti belum dipilih. */
  value: string | undefined | null
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  size?: "sm" | "default"
  "aria-invalid"?: boolean
  /** Tampilkan tombol untuk mengosongkan tanggal. */
  clearable?: boolean
}

function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pilih tanggal",
  disabled,
  className,
  size = "default",
  "aria-invalid": ariaInvalid,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const date = toDate(value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          data-empty={!date}
          className={cn(
            "w-full justify-start gap-2 px-3 font-normal data-[empty=true]:text-muted-foreground",
            size === "sm" ? "h-8 text-xs" : "h-9",
            className
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-70" />
          <span className="truncate">
            {date ? format(date, "d MMM yyyy", { locale: localeId }) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          captionLayout="dropdown"
          locale={localeId}
          onSelect={(d) => {
            onChange(d ? format(d, VALUE_FORMAT) : "")
            setOpen(false)
          }}
        />
        {clearable && date && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
            >
              Hapus tanggal
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
