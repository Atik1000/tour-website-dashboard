'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, ChevronRight, Edit, Trash2, Plus, Clock, Loader2, AlertCircle, CheckCircle2, CalendarDays, Check, X, MapPin } from 'lucide-react'
import { getTourPlanDetail, deleteTourPlan, TourPlan } from '@/app/lib/api'
import { getCookie } from '@/app/lib/cookies'
import { LocationModal } from '@/components/dashboard/location-modal'
import { DateModal } from '@/components/dashboard/date-modal'
import { fetchTourDates } from '@/app/lib/redux/tour-date-slice'
import { RootState, AppDispatch } from '@/app/lib/redux/store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const TimeSlotCount = ({ dateId }: { dateId: string }) => {
  const [count, setCount] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const token = getCookie('access_token')
        if (token) {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/tour/plan/date/time/${dateId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          const data = await response.json()
          setCount(data.count || 0)
        }
      } catch (err) {
        console.error('Failed to fetch time count:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCount()
  }, [dateId])

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />

  return (
    <span className="text-muted-foreground">
      {count} time slot{count !== 1 ? 's' : ''}
    </span>
  )
}

// "2026-11-22" -> "22 Nov 2026". Format in UTC so date-only strings don't shift a day in negative-offset timezones.
const formatTourDate = (value: string) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function TourDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const tourId = params.id as string
  const dispatch = useDispatch<AppDispatch>()
  const { dates: reduxDates, isLoading: isDatesLoading } = useSelector((state: RootState) => state.tourDate)

  const [tour, setTour] = useState<TourPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [dateModalOpen, setDateModalOpen] = useState(false)
  const [locationMode, setLocationMode] = useState<'create' | 'edit'>('create')

  // Newest date first
  const sortedDates = useMemo(
    () => [...reduxDates].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [reduxDates]
  )

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error';
    onConfirm?: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    type: 'success'
  })

  useEffect(() => {
    const fetchTourDetail = async () => {
      try {
        setIsLoading(true)
        const token = getCookie('access_token')
        if (token && tourId) {
          const data = await getTourPlanDetail(token, tourId)
          setTour(data)
          // Also fetch dates via Redux
          dispatch(fetchTourDates(parseInt(tourId)))
        } else if (!token) {
          setError('Authentication token not found. Please log in again.')
        }
      } catch (err) {
        setError('Failed to fetch tour details. Please try again later.')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTourDetail()
  }, [tourId, dispatch])

  const handlePrevImage = () => {
    if (!tour?.images.length) return
    setCurrentImageIndex((prev) => (prev === 0 ? tour.images.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    if (!tour?.images.length) return
    setCurrentImageIndex((prev) => (prev === tour.images.length - 1 ? 0 : prev + 1))
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      const token = getCookie('access_token')
      if (!token) {
        throw new Error('Authentication token not found.')
      }

      await deleteTourPlan(token, tourId)

      setAlertConfig({
        show: true,
        title: 'Success',
        message: 'Tour deleted successfully.',
        type: 'success',
        onConfirm: () => router.push('/dashboard/tours')
      })
    } catch (err: any) {
      console.error('Delete tour error:', err)
      let errorMessage = 'Failed to delete tour. Please try again.'
      if (err) {
        const errorDetails = Object.entries(err).map(([key, value]) => {
          if (Array.isArray(value)) return `${key}: ${value.join(', ')}`
          return `${key}: ${value}`
        }).join('\n')
        errorMessage = errorDetails || errorMessage
      }

      setAlertConfig({
        show: true,
        title: 'Error',
        message: errorMessage,
        type: 'error'
      })
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !tour) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
        <Card className="p-8 max-w-md border-border">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">{error || "Tour not found"}</h2>
          <Link href="/dashboard/tours">
            <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
              Back to Tours
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        <Link href="/dashboard/tours" className="text-muted-foreground hover:text-foreground transition-colors">
          Tours
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">Tour details</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{tour.title}</h1>
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium capitalize ${tour.is_active
                ? 'bg-green-100 text-green-700'
                : 'bg-secondary text-muted-foreground'
                }`}
            >
              {tour.is_active ? 'Active' : (tour.status || 'Inactive')}
            </span>
          </div>
          <p className="text-muted-foreground text-sm sm:text-base line-clamp-2 md:line-clamp-none">{tour.description}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Link href={`/dashboard/tours/${tour.id}/edit`}>
            <Button variant="outline" className="h-10 px-4 border-border bg-background cursor-pointer">
              <Edit size={16} />
              Edit tour
            </Button>
          </Link>
          <Button
            variant="outline"
            size="icon"
            aria-label="Delete tour"
            onClick={() => setIsDeleteDialogOpen(true)}
            className="h-10 w-10 border-border bg-background text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      {/* Top section: summary card + dates */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6">
        {/* Image & Quick Info */}
        <Card className="border-border overflow-hidden shadow-sm py-0 gap-0">
          <div className="relative bg-secondary aspect-[16/9]">
            <img
              src={tour.images[currentImageIndex]?.file || "/placeholder.svg"}
              alt={tour.title}
              className="w-full h-full object-cover"
            />
            {tour.images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-all cursor-pointer"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={handleNextImage}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-full transition-all cursor-pointer"
                >
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
                  {tour.images.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${i === currentImageIndex ? 'bg-white w-5' : 'bg-white/50 w-1.5'}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="px-6 pb-5 pt-4">
            <div className="pb-3">
              <p className="text-sm text-muted-foreground">Starting from</p>
              <p className="text-3xl font-bold text-primary">${tour.price_adult}</p>
            </div>
            {tour.duration_days && (
              <div className="flex items-center gap-3 py-3 border-t border-border">
                <Clock className="text-foreground" size={20} />
                <span className="text-foreground font-medium">
                  {tour.duration_days} day{Number(tour.duration_days) !== 1 ? 's' : ''}
                </span>
              </div>
            )}
            {tour.free_cancellation && (
              <div className="flex items-center gap-3 py-3 border-t border-border">
                <CheckCircle2 className="text-green-600" size={20} />
                <span className="text-green-700 font-medium">Free cancellation</span>
              </div>
            )}
            {tour.pickup_included && (
              <div className="flex items-center gap-3 py-3 border-t border-border">
                <CheckCircle2 className="text-blue-600" size={20} />
                <span className="text-blue-700 font-medium">Pickup included</span>
              </div>
            )}
          </div>
        </Card>

        {/* Dates & Tickets */}
        <Card className="p-6 border-border shadow-sm gap-0">
          <div className="flex items-center justify-between gap-4 mb-5">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Dates &amp; Tickets</h2>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 cursor-pointer"
              onClick={() => setDateModalOpen(true)}
            >
              <Plus size={18} />
              Add new date
            </Button>
          </div>

          {isDatesLoading && sortedDates.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sortedDates.length > 0 ? (
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-4 bg-secondary px-4 py-3 text-sm font-medium text-muted-foreground">
                <span>Date</span>
                <span>Time slots</span>
                <span className="w-5" />
              </div>
              <div className="max-h-[22rem] overflow-y-auto divide-y divide-border">
                {sortedDates.map((date: any) => (
                  <Link
                    key={date.id}
                    href={`/dashboard/tours/${tour.id}/dates/${date.id}`}
                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-4 px-4 py-3 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <CalendarDays size={20} />
                      </span>
                      <span className="font-semibold text-foreground truncate">{formatTourDate(date.date)}</span>
                    </div>
                    <TimeSlotCount dateId={date.id.toString()} />
                    <ChevronRight size={18} className="text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border py-10 text-center">
              <CalendarDays className="mx-auto mb-2 text-muted-foreground" size={28} />
              <p className="text-muted-foreground text-sm">No dates scheduled yet</p>
            </div>
          )}
        </Card>
      </div>

      {/* Detail tabs */}
      <Tabs defaultValue="overview" className="gap-6">
        <TabsList className="h-auto w-full justify-start gap-2 sm:gap-6 rounded-none border-b border-border bg-transparent p-0 overflow-x-auto overflow-y-hidden">
          {[
            { value: 'overview', label: 'Overview' },
            { value: 'locations', label: 'Locations' },
            { value: 'includes', label: 'Includes & Excludes' },
            { value: 'info', label: 'Important Information' },
          ].map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="flex-none -mb-px h-auto rounded-none border-0 border-b-[3px] border-transparent bg-transparent px-2 pb-3 pt-1 text-base font-medium text-foreground shadow-none cursor-pointer data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <Card className="p-6 border-border shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-8">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-4">Overview</h2>
                {tour.full_description ? (
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line wrap-break-word">{tour.full_description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description</p>
                )}
              </div>
              <div className="pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-border md:pl-8">
                <h2 className="text-xl font-bold text-foreground mb-4">Highlights</h2>
                {tour.highlights && tour.highlights.length > 0 ? (
                  <ul className="space-y-3">
                    {tour.highlights.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground">
                        <Check size={18} className="text-primary flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No highlights</p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Locations */}
        <TabsContent value="locations">
          <Card className="p-6 border-border shadow-sm">
            <h2 className="text-xl font-bold text-foreground mb-4">Locations</h2>
            {tour.locations.length > 0 ? (
              <ul className="divide-y divide-border">
                {tour.locations.map((location) => (
                  <li key={location.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <MapPin size={18} />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{location.name}</p>
                      {location.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{location.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm italic">No locations added yet</p>
            )}
          </Card>
        </TabsContent>

        {/* Includes & Excludes */}
        <TabsContent value="includes">
          <Card className="p-6 border-border shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-4">Includes</h2>
                {tour.includes.length > 0 ? (
                  <ul className="space-y-3">
                    {tour.includes.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground">
                        <Check size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">None</p>
                )}
              </div>
              <div className="pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-border md:pl-8">
                <h2 className="text-xl font-bold text-foreground mb-4">Excludes</h2>
                {tour.excludes.length > 0 ? (
                  <ul className="space-y-3">
                    {tour.excludes.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground">
                        <X size={18} className="text-destructive flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">None</p>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Important Information */}
        <TabsContent value="info">
          <Card className="p-6 border-border shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-4">Know before you go</h2>
                {tour.know_before_you_go.length > 0 ? (
                  <ol className="space-y-3">
                    {tour.know_before_you_go.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground">
                        <span className="text-primary font-semibold flex-shrink-0">{i + 1}.</span>
                        {item}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No specific info</p>
                )}
              </div>
              <div className="space-y-6 pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-border md:pl-8">
                <div>
                  <h2 className="text-xl font-bold text-foreground mb-4">Not allowed</h2>
                  {tour.not_allowed.length > 0 ? (
                    <ul className="space-y-3">
                      {tour.not_allowed.map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-muted-foreground">
                          <X size={18} className="text-destructive flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No restrictions</p>
                  )}
                </div>
                <div className="pt-6 border-t border-border">
                  <h2 className="text-xl font-bold text-foreground mb-4">Not suitable for</h2>
                  {tour.not_suitable_for.length > 0 ? (
                    <ul className="space-y-3">
                      {tour.not_suitable_for.map((item, i) => (
                        <li key={i} className="flex items-start gap-3 text-muted-foreground">
                          <X size={18} className="text-destructive flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No specifics</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals placeholders */}
      <LocationModal
        isOpen={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        onSave={() => setLocationModalOpen(false)}
        initialLocations={tour.locations.map(loc => ({
          ...loc,
          id: loc.id.toString()
        }))}
        mode={locationMode}
      />

      <DateModal
        isOpen={dateModalOpen}
        onClose={() => setDateModalOpen(false)}
        onSave={() => {
          dispatch(fetchTourDates(parseInt(tourId)))
          setDateModalOpen(false)
        }}
        initialDates={reduxDates.map((d: any) => ({
          ...d,
          id: d.id.toString()
        }))}
        tourId={parseInt(tourId)}
      />

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md border-destructive/20 bg-background/95 backdrop-blur-lg">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <Trash2 size={24} />
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-foreground/80 font-medium">
              This action cannot be undone. This will permanently delete the tour
              <span className="font-semibold text-destructive px-1">"{tour?.title}"</span>
              and all of its associated data including dates and time slots.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer border-border bg-transparent hover:bg-secondary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="cursor-pointer bg-destructive hover:bg-destructive/90 text-white border-0"
            >
              {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'Delete Tour'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Feedback Alert Dialog */}
      <AlertDialog
        open={alertConfig.show}
        onOpenChange={(v) => setAlertConfig({ ...alertConfig, show: v })}
      >
        <AlertDialogContent className={`max-w-md border-0 bg-background/95 backdrop-blur-lg shadow-2xl`}>
          <div className={`absolute top-0 left-0 w-full h-1 ${alertConfig.type === 'success' ? 'bg-primary' : 'bg-destructive'}`} />
          <AlertDialogHeader>
            <div className={`flex items-center gap-2 ${alertConfig.type === 'success' ? 'text-primary' : 'text-destructive'} mb-2`}>
              {alertConfig.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
              <AlertDialogTitle className="text-lg font-semibold">{alertConfig.title}</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-foreground/80 text-base font-medium whitespace-pre-line">
              {alertConfig.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setAlertConfig({ ...alertConfig, show: false })
                if (alertConfig.onConfirm) alertConfig.onConfirm()
              }}
              className={`cursor-pointer ${alertConfig.type === 'success' ? 'bg-primary hover:bg-primary/90' : 'bg-destructive hover:bg-destructive/90'} text-white border-0 px-8`}
            >
              {alertConfig.type === 'success' ? 'Continue' : 'Okay'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
