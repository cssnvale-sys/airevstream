import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@airevstream/db';

export const dynamic = 'force-dynamic';
// Keep fresh for 60s; lets us publish changes without a full revalidation flow.
export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

type StorefrontView = Awaited<ReturnType<typeof loadStorefront>>;

async function loadStorefront(slug: string) {
  const db = getDb();
  const storefront = await db.storefront.findFirst({
    where: { slug, status: 'published' },
    include: {
      channel: { select: { id: true, name: true } },
      products: {
        where: { status: 'active' },
        orderBy: [{ featured: 'desc' }, { displayOrder: 'asc' }],
        include: {
          affiliateProduct: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
              shortUrl: true,
              brand: true,
              category: true,
              status: true,
            },
          },
        },
      },
    },
  });
  if (!storefront) return null;
  const products = storefront.products
    .filter((sp) => sp.affiliateProduct && sp.affiliateProduct.status === 'active')
    .map((sp) => ({
      id: sp.id,
      featured: sp.featured,
      title: sp.customTitle ?? sp.affiliateProduct!.name,
      description: sp.customDescription ?? sp.affiliateProduct!.description,
      imageUrl: sp.affiliateProduct!.imageUrl,
      brand: sp.affiliateProduct!.brand,
      category: sp.affiliateProduct!.category,
      url: sp.affiliateProduct!.shortUrl,
    }));
  return {
    name: storefront.name,
    description: storefront.description,
    logoUrl: storefront.logoUrl,
    bannerUrl: storefront.bannerUrl,
    channelName: storefront.channel.name,
    products,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const storefront = await loadStorefront(slug).catch(() => null);
  if (!storefront) return { title: 'Not found' };
  return {
    title: storefront.name,
    description: storefront.description ?? `${storefront.name} — shop by ${storefront.channelName}`,
    openGraph: {
      title: storefront.name,
      description: storefront.description ?? undefined,
      images: storefront.bannerUrl ? [storefront.bannerUrl] : undefined,
    },
  };
}

/**
 * Public-facing storefront page. No auth required.
 *
 * This page renders a published affiliate storefront for a given slug (e.g.
 * /p/cool-creator). Drafts and archived storefronts 404 so unpublished URLs
 * cannot be discovered by guessing.
 *
 * Clicking a product hits /api/v1/affiliate/redirect/<shortCode> which records
 * the click and 302s onward to the real affiliate URL. The referer plus the
 * ?storefront=<slug> query lets the analytics pipeline attribute revenue back
 * to the storefront and the channel.
 */
export default async function PublicStorefrontPage({ params }: PageProps) {
  const { slug } = await params;
  const storefront: StorefrontView = await loadStorefront(slug);
  if (!storefront) notFound();

  const featured = storefront.products.filter((p) => p.featured);
  const rest = storefront.products.filter((p) => !p.featured);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      {storefront.bannerUrl ? (
        <div className="relative h-56 w-full overflow-hidden md:h-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={storefront.bannerUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        </div>
      ) : null}

      <header className="mx-auto max-w-5xl px-6 pt-8 pb-6">
        <div className="flex items-center gap-4">
          {storefront.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={storefront.logoUrl}
              alt={`${storefront.name} logo`}
              className="h-14 w-14 rounded-lg object-cover"
              loading="eager"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent-purple text-lg font-bold text-white">
              {storefront.name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{storefront.name}</h1>
            <p className="text-sm text-text-secondary">by {storefront.channelName}</p>
          </div>
        </div>
        {storefront.description ? (
          <p className="mt-4 max-w-3xl text-base text-text-secondary">{storefront.description}</p>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-16">
        {featured.length > 0 ? (
          <section className="mb-10">
            <h2 className="mb-4 text-xl font-semibold">Featured</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}

        {rest.length > 0 ? (
          <section>
            {featured.length > 0 ? (
              <h2 className="mb-4 text-xl font-semibold">All Products</h2>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}

        {storefront.products.length === 0 ? (
          <div className="rounded-lg border border-border-subtle bg-bg-secondary p-8 text-center">
            <p className="text-text-secondary">This storefront has no products yet.</p>
          </div>
        ) : null}
      </main>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-text-secondary">
          <p>
            Some links are affiliate links — we may earn a commission when you make a purchase.
            <span className="mx-2">·</span>
            <Link href="/" className="hover:underline">
              Powered by AiRevStream
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({
  product,
}: {
  product: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    brand: string | null;
    category: string | null;
    url: string | null;
  };
}) {
  const href = product.url ?? '#';
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored nofollow noopener"
      className="group flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-secondary transition hover:border-accent-purple"
    >
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.title}
          className="h-48 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-bg-tertiary text-4xl">
          {product.title.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-1 p-4">
        {product.brand ? (
          <span className="text-xs uppercase tracking-wide text-text-secondary">{product.brand}</span>
        ) : null}
        <h3 className="text-base font-semibold group-hover:text-accent-purple">{product.title}</h3>
        {product.description ? (
          <p className="line-clamp-3 text-sm text-text-secondary">{product.description}</p>
        ) : null}
        {product.category ? (
          <span className="mt-auto inline-block self-start rounded-full bg-bg-tertiary px-2 py-0.5 text-xs text-text-secondary">
            {product.category}
          </span>
        ) : null}
      </div>
    </a>
  );
}
