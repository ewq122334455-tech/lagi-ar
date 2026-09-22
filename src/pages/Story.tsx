import { Link } from 'react-router-dom';
import { useProducts } from '@/hooks/useProducts';
import { Loading } from '@/components/Loading';
import { ErrorState } from '@/components/ErrorState';
import { ContentBadge } from '@/components/ContentBadge';

export default function Story() {
  const state = useProducts();
  const withStory = state.status === 'ready' ? state.data.filter((p) => p.story.value) : [];
  const withoutStory = state.status === 'ready' ? state.data.filter((p) => !p.story.value) : [];

  return (
    <div>
      <section className="border-b border-line bg-ink px-6 py-24 text-paper lg:px-10 lg:py-32">
        <div className="mx-auto max-w-canvas">
          <p className="eyebrow text-mist">STORY</p>
          <h1 className="mt-4 max-w-2xl font-display text-5xl leading-tight lg:text-6xl">
            제품마다 만들어진 이유가 있습니다.
          </h1>
        </div>
      </section>

      <section className="px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-canvas">
          {state.status === 'loading' && <Loading label="불러오는 중" />}
          {state.status === 'error' && <ErrorState message={state.message} />}

          {state.status === 'ready' && withStory.length > 0 && (
            <div className="flex flex-col gap-16">
              {withStory.map((p) => (
                <Link key={p.id} to={`/product/${p.id}`} className="group block focus-ring">
                  <p className="eyebrow text-stone">{p.name.value ?? p.id}</p>
                  <p className="mt-3 max-w-2xl text-xl leading-relaxed text-graphite group-hover:text-ink lg:text-2xl">
                    {p.story.value}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {state.status === 'ready' && withStory.length === 0 && (
            <div>
              <ContentBadge status="CONTENT_REQUIRED" />
              <p className="mt-3 text-sm text-graphite">등록된 제품 스토리가 아직 없습니다.</p>
            </div>
          )}

          {state.status === 'ready' && withoutStory.length > 0 && (
            <div className="mt-20 border-t border-line pt-10">
              <p className="eyebrow mb-4">STORY — CONTENT REQUIRED</p>
              <ul className="flex flex-wrap gap-3">
                {withoutStory.map((p) => (
                  <li key={p.id}>
                    <Link to={`/product/${p.id}`} className="text-sm text-stone underline hover:text-graphite focus-ring">
                      {p.name.value ?? p.id}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
