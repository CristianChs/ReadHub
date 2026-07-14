import { Skeleton } from "@/components/ui/skeleton";

// Silueta del detalle mientras se resuelve el segmento. Reproduce la geometría
// de ArticleHeader (portada 16/9 -> 21/9, título, autor) para que la llegada
// del contenido real no desplace nada.
export default function ArticleLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Skeleton className="h-8 w-36" />

      <div className="space-y-6">
        <Skeleton className="aspect-[16/9] w-full rounded-xl sm:aspect-[21/9]" />

        <div className="space-y-4">
          <Skeleton className="h-9 w-4/5" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
