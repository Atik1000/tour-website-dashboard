import type { TourPlan, TourTime } from "@/app/lib/api"

export type TravelerKey = "adults" | "children" | "infants" | "youths" | "students"

export interface TravelerLimit {
    show: boolean
    max: number
}

export type TravelerLimits = Record<TravelerKey, TravelerLimit>

// Upper bound per traveler type when neither the tour nor the time slot sets one.
const DEFAULT_MAX_PER_TYPE = 20

const FIELDS: Record<TravelerKey, { tourMax: keyof TourPlan; slotAvailable: keyof TourTime }> = {
    adults: { tourMax: "max_adults", slotAvailable: "available_adults" },
    children: { tourMax: "max_children", slotAvailable: "available_children" },
    infants: { tourMax: "max_infants", slotAvailable: "available_infants" },
    youths: { tourMax: "max_youth", slotAvailable: "available_youth" },
    students: { tourMax: "max_student_eu", slotAvailable: "available_student_eu" },
}

/**
 * How many travelers of each type can be picked.
 *
 * Ticket capacity lives on the time slot (`available_*`). The per-tour `max_*`
 * fields are optional per-booking caps and are 0 on tours where the admin never
 * set them, so 0 must not be read as "this traveler type is not offered" unless
 * the tour sets a cap for at least one other type.
 */
export function getTravelerLimits(
    tour: TourPlan,
    slot?: TourTime | null
): TravelerLimits {
    const keys = Object.keys(FIELDS) as TravelerKey[]
    const tourMax = (key: TravelerKey) => Number(tour[FIELDS[key].tourMax]) || 0
    const tourSetsCaps = keys.some((key) => tourMax(key) > 0)

    const limits = {} as TravelerLimits
    for (const key of keys) {
        const cap = tourMax(key)
        let max = cap > 0 ? cap : DEFAULT_MAX_PER_TYPE
        const available = slot ? Number(slot[FIELDS[key].slotAvailable]) : NaN
        if (Number.isFinite(available)) max = Math.min(max, Math.max(0, available))
        limits[key] = { show: tourSetsCaps ? cap > 0 : true, max }
    }
    return limits
}
