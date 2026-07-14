import { ArticleListSkeleton } from "@/components/articles/article-card-skeleton";

// Límite de Suspense del área privada.
//
// Sin este archivo, el esqueleto del listado solo aparecía DESPUÉS de que el
// navegador descargara e hidratara el bundle (lo pintaba el estado `loading`
// de useArticles, ya en cliente). Con él, Next lo emite en el HTML del
// servidor: hay contenido en pantalla sin esperar a JavaScript.
//
// No sustituye al estado de carga del hook —ese sigue gobernando la petición
// de datos—; se limita a cubrir el hueco anterior, que hasta ahora estaba en
// blanco.
export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Artículos
        </h1>
        <p className="text-sm text-muted-foreground">
          Explora las últimas publicaciones de la comunidad.
        </p>
      </header>

      <ArticleListSkeleton />
    </div>
  );
}
