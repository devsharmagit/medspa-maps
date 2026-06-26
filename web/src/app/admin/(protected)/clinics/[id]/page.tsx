import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Store, ArrowLeft, Pencil, Building2, UserCircle2, MapPin } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export const dynamic = "force-dynamic";

interface ClinicDetailed {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  website: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  booking_url: string | null;
  google_maps_url: string | null;
  about: string | null;
  is_active: boolean;
  verified: boolean;
  tier: string;
  created_at: string;
  g99_clinic_id: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  google_my_business: string | null;
  google_place_id: string | null;
  yelp_url: string | null;
  avg_rating: string | null;
  review_count: number;
}

interface ImageRow {
  id: string;
  source_url: string;
  cdn_url: string | null;
  alt_text: string | null;
  role: string;
}

interface ServiceRow {
  id: string;
  raw_name: string;
  description: string | null;
  is_active: boolean;
}

interface ProviderRow {
  id: string;
  name: string;
  title: string | null;
  image_url: string | null;
  is_verified: boolean;
  years_experience: number | null;
  is_active: boolean;
}

interface LocationRow {
  id: string;
  label: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  booking_url: string | null;
  google_maps_url: string | null;
  is_primary: boolean;
  sort_order: number;
}

export default async function ClinicDetailPage(props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const { id } = await props.params;

  const clinic = await queryOne<ClinicDetailed>("SELECT * FROM clinics WHERE id = $1", [id]);
  
  if (!clinic) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-slate-500">
        <Store size={48} className="opacity-20 mb-4" />
        <p>Clinic not found.</p>
        <Link href="/admin/clinics">
          <Button variant="outline" className="mt-4">Back to Clinics</Button>
        </Link>
      </div>
    );
  }

  const [business, images, services, providers, locations] = await Promise.all([
    queryOne<{ name: string }>("SELECT name FROM businesses WHERE id = $1", [clinic.business_id]),
    query<ImageRow>("SELECT * FROM images WHERE entity_type = 'clinic' AND entity_id = $1 ORDER BY sort_order ASC", [id]),
    query<ServiceRow>("SELECT id, raw_name, description, is_active FROM clinic_services WHERE clinic_id = $1 ORDER BY created_at ASC", [id]),
    query<ProviderRow>("SELECT id, name, title, image_url, is_verified, years_experience, is_active FROM providers WHERE clinic_id = $1 ORDER BY created_at ASC", [id]),
    query<LocationRow>("SELECT id, label, address, city, state, zip, phone, booking_url, google_maps_url, is_primary, sort_order FROM clinic_locations WHERE clinic_id = $1 AND is_active = true ORDER BY sort_order, created_at ASC", [id]),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/clinics">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              {clinic.name}
              {!clinic.is_active && <Badge variant="secondary" className="bg-slate-100 text-slate-500">Disabled</Badge>}
            </h2>
            {business && (
              <Link href={`/admin/businesses/${clinic.business_id}`} className="text-xs text-brand-purple hover:underline flex items-center gap-1 mt-0.5">
                <Building2 size={12} /> Part of {business.name}
              </Link>
            )}
          </div>
        </div>
        
        <Button asChild className="bg-brand-purple hover:bg-brand-magenta text-white gap-2">
          <Link href={`/admin/clinics/${clinic.id}/edit`}>
            <Pencil size={14} />
            Edit Clinic
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-base font-semibold text-slate-800">Clinic Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-y-6 gap-x-8 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider font-semibold">Tier</p>
                  <p className="capitalize font-medium text-slate-800">{clinic.tier}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider font-semibold">Verified</p>
                  <Badge variant={clinic.verified ? "default" : "secondary"} className={clinic.verified ? "bg-blue-50 text-blue-700 hover:bg-blue-50" : ""}>
                    {clinic.verified ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs mb-1.5 uppercase tracking-wider font-semibold">About</p>
                  <p className="text-slate-700 whitespace-pre-wrap">{clinic.about || "No description provided."}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Providers */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                Providers
                <Badge variant="secondary" className="font-normal">{providers.length}</Badge>
              </CardTitle>
              <Button asChild size="sm" className="h-7 gap-1 text-xs bg-brand-purple hover:bg-brand-magenta text-white">
                <Link href={`/admin/clinics/${id}/providers/new`}>
                  <UserCircle2 size={13} /> Add Provider
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {providers.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No providers added yet.</div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {providers.map((provider) => (
                    <div key={provider.id} className="p-4 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0 flex items-center justify-center">
                        {provider.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={provider.image_url} alt={provider.name} className="h-full w-full object-cover" />
                        ) : (
                          <UserCircle2 size={20} className="text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm text-slate-800 truncate">{provider.name}</p>
                          {provider.is_verified && (
                            <span className="text-blue-500 text-xs font-semibold">✓ Verified</span>
                          )}
                          {!provider.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                        </div>
                        {provider.title && <p className="text-xs text-slate-500 truncate">{provider.title}</p>}
                        {provider.years_experience && <p className="text-xs text-slate-400">{provider.years_experience}+ yrs experience</p>}
                      </div>
                      <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs h-7">
                        <Link href={`/admin/providers/${provider.id}/edit`}>Edit</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Services */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                Services
                <Badge variant="secondary" className="font-normal">{services.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {services.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No services listed for this clinic.</div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {services.map(service => (
                    <div key={service.id} className="p-4 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-slate-800">{service.raw_name}</p>
                        {!service.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                      </div>
                      {service.description && <p className="text-xs text-slate-500 line-clamp-2">{service.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Images */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                Images
                <Badge variant="secondary" className="font-normal">{images.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {images.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-4">No images available.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {images.map(img => (
                    <div key={img.id} className="group relative aspect-square rounded-md overflow-hidden bg-slate-100 border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={img.cdn_url || img.source_url} 
                        alt={img.alt_text || "Clinic image"} 
                        className="object-cover w-full h-full"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 text-white text-[10px]">
                        <span className="truncate">{img.role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Data */}
        <div className="flex flex-col gap-6">
          {/* Locations */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                Locations
                <Badge variant="secondary" className="font-normal">{locations.length}</Badge>
              </CardTitle>
              <Button asChild size="sm" className="h-7 gap-1 text-xs bg-brand-purple hover:bg-brand-magenta text-white">
                <Link href={`/admin/clinics/${id}/edit`}>
                  <Pencil size={12} /> Manage
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {locations.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No locations added yet.</div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100">
                  {locations.map((loc) => (
                    <div key={loc.id} className="p-4 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-brand-purple shrink-0" />
                        <span className="text-sm font-medium text-slate-800">
                          {loc.label || loc.city || "Unnamed location"}
                        </span>
                        {loc.is_primary && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 text-brand-purple border-brand-purple/30">
                            Primary
                          </Badge>
                        )}
                      </div>
                      {loc.address && (
                        <p className="text-xs text-slate-500 ml-5">{loc.address}</p>
                      )}
                      <p className="text-xs text-slate-500 ml-5">
                        {[loc.city, loc.state, loc.zip].filter(Boolean).join(", ")}
                      </p>
                      {loc.phone && (
                        <p className="text-xs text-slate-400 ml-5">{loc.phone}</p>
                      )}
                      {loc.google_maps_url && (
                        <a
                          href={loc.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-brand-purple hover:underline ml-5"
                        >
                          View on Maps
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-base font-semibold text-slate-800">Online Presence</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col gap-4">
              <div>
                <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">Website</p>
                {clinic.website ? (
                  <a href={clinic.website} target="_blank" rel="noreferrer" className="text-sm text-brand-purple hover:underline break-all">
                    {clinic.website}
                  </a>
                ) : <p className="text-sm text-slate-400">N/A</p>}
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">Booking URL</p>
                {clinic.booking_url ? (
                  <a href={clinic.booking_url} target="_blank" rel="noreferrer" className="text-sm text-brand-purple hover:underline break-all">
                    {clinic.booking_url}
                  </a>
                ) : <p className="text-sm text-slate-400">N/A</p>}
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">Google Maps URL</p>
                {clinic.google_maps_url ? (
                  <a href={clinic.google_maps_url} target="_blank" rel="noreferrer" className="text-sm text-brand-purple hover:underline break-all">
                    {clinic.google_maps_url}
                  </a>
                ) : <p className="text-sm text-slate-400">N/A</p>}
              </div>

              <div className="pt-2 mt-2 border-t border-slate-100 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">Instagram</p>
                  {clinic.instagram_url ? (
                    <a href={clinic.instagram_url} target="_blank" rel="noreferrer" className="text-sm text-brand-purple hover:underline break-all line-clamp-1">Link</a>
                  ) : <p className="text-sm text-slate-400">N/A</p>}
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">Facebook</p>
                  {clinic.facebook_url ? (
                    <a href={clinic.facebook_url} target="_blank" rel="noreferrer" className="text-sm text-brand-purple hover:underline break-all line-clamp-1">Link</a>
                  ) : <p className="text-sm text-slate-400">N/A</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <CardTitle className="text-base font-semibold text-slate-800">Ratings & System</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">Rating</p>
                  <p className="text-sm text-slate-800">{clinic.avg_rating || "N/A"}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">Reviews</p>
                  <p className="text-sm text-slate-800">{clinic.review_count || "0"}</p>
                </div>
              </div>
              <div className="pt-2 mt-2 border-t border-slate-100">
                <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">G99 Clinic ID</p>
                <p className="text-sm font-mono text-slate-800">{clinic.g99_clinic_id || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">Google Place ID</p>
                <p className="text-sm font-mono text-slate-800">{clinic.google_place_id || "N/A"}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs mb-1 font-semibold uppercase tracking-wider">Added</p>
                <p className="text-sm text-slate-800">{new Date(clinic.created_at).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
