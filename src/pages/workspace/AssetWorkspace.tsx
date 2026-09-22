import { useEffect, useMemo, useState } from 'react';
import type { Hotspot, HotspotCategory, MaterialEntry, ProcessStep, Product } from '@/data/productTypes';
import { readLocalDrafts, writeLocalDraft, deleteLocalDraft, invalidateProductCache, loadProducts } from '@/data/productEngine';
import { createEmptyProduct } from './emptyProduct';
import { validateProduct } from './validateProduct';
import { Field, TextInput, TextArea, NumberInput, SelectInput } from './fields';
import { ContentBadge } from '@/components/ContentBadge';
import { ProductViewer } from '@/three/ProductViewer';
import { getAIProvider } from '@/ai/AIProvider';
import { getThreeDGenerationProvider } from '@/ai/ThreeDGenerationProvider';
import type { Observation } from '@/utils/contentStatus';
import { modelFormatOf } from '@/utils/modelFile';

const TABS = ['BASIC', 'IMAGES', '3D & AR', 'HOTSPOTS', 'MATERIAL & PROCESS', 'AI ANALYSIS', 'PREVIEW & PUBLISH'] as const;
type Tab = (typeof TABS)[number];

const CATEGORIES: HotspotCategory[] = ['MATERIAL', 'DETAIL', 'CRAFT', 'PROCESS', 'STRUCTURE', 'FUNCTION'];

export default function AssetWorkspace() {
  const [publishedIds, setPublishedIds] = useState<string[]>([]);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [product, setProduct] = useState<Product>(() => createEmptyProduct('product-002'));
  const [tab, setTab] = useState<Tab>('BASIC');
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    loadProducts().then((list) => setPublishedIds(list.map((p) => p.id)));
    setDraftIds(readLocalDrafts().map((p) => p.id));
  }, []);

  const issues = useMemo(() => validateProduct(product), [product]);
  const errorCount = issues.filter((i) => i.level === 'error').length;

  function update<K extends keyof Product>(key: K, value: Product[K]) {
    setProduct((p) => ({ ...p, [key]: value }));
    setSavedMessage(null);
  }

  function loadExisting(id: string) {
    const drafts = readLocalDrafts();
    const draft = drafts.find((p) => p.id === id);
    if (draft) {
      setProduct(draft);
      return;
    }
    loadProducts().then((list) => {
      const found = list.find((p) => p.id === id);
      if (found) setProduct(found);
    });
  }

  function saveDraft() {
    writeLocalDraft(product);
    invalidateProductCache();
    setDraftIds(readLocalDrafts().map((p) => p.id));
    setSavedMessage('이 브라우저에 임시 저장되었습니다. /product/' + product.id + ' 에서 미리보기할 수 있습니다.');
  }

  function removeDraft() {
    deleteLocalDraft(product.id);
    setDraftIds(readLocalDrafts().map((p) => p.id));
    setSavedMessage('임시 저장이 삭제되었습니다.');
  }

  function downloadJson() {
    const blob = new Blob([JSON.stringify(product, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'product.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-6 py-16 lg:px-10 lg:py-20">
      <div className="mx-auto max-w-canvas">
        <p className="eyebrow">INTERNAL TOOL</p>
        <h1 className="mt-3 text-3xl font-medium lg:text-4xl">Product Creation Workspace</h1>
        <p className="mt-4 max-w-2xl text-sm text-graphite">
          이 도구는 개발/운영자용입니다. 정식 배포 전까지는 일반 방문자에게 노출하지 마세요. 이 사이트는 정적으로
          배포되므로, 게시는 <code>product.json</code>을 내려받아 <code>public/products/&lt;id&gt;/</code>에 커밋하는
          방식으로 이루어집니다. "임시 저장"은 이 브라우저에서만 미리보기를 위해 사용됩니다.
        </p>

        {/* PRODUCT SELECTOR */}
        <div className="mt-10 flex flex-wrap items-end gap-4 border-y border-line py-6">
          <Field label="PRODUCT ID">
            <TextInput
              value={product.id}
              onChange={(e) => update('id', e.target.value.trim())}
              placeholder="product-002"
            />
          </Field>
          <Field label="LOAD EXISTING">
            <SelectInput onChange={(e) => e.target.value && loadExisting(e.target.value)} defaultValue="">
              <option value="" disabled>
                선택...
              </option>
              {publishedIds.map((id) => (
                <option key={id} value={id}>
                  {id} (published)
                </option>
              ))}
              {draftIds.map((id) => (
                <option key={id} value={id}>
                  {id} (draft)
                </option>
              ))}
            </SelectInput>
          </Field>
          <button
            type="button"
            onClick={() => setProduct(createEmptyProduct(`product-${Date.now().toString().slice(-4)}`))}
            className="eyebrow border border-line px-4 py-2.5 hover:border-ink focus-ring"
          >
            NEW PRODUCT
          </button>
        </div>

        {/* TABS */}
        <div className="mt-8 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`eyebrow border px-4 py-2.5 focus-ring ${
                tab === t ? 'border-ink bg-ink text-paper' : 'border-line text-graphite hover:border-ink'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-10">
          {tab === 'BASIC' && <BasicTab product={product} update={update} />}
          {tab === 'IMAGES' && <ImagesTab product={product} update={update} />}
          {tab === '3D & AR' && <ThreeDArTab product={product} update={update} />}
          {tab === 'HOTSPOTS' && <HotspotsTab product={product} update={update} />}
          {tab === 'MATERIAL & PROCESS' && <MaterialProcessTab product={product} update={update} />}
          {tab === 'AI ANALYSIS' && <AIAnalysisTab product={product} update={update} />}
          {tab === 'PREVIEW & PUBLISH' && (
            <PreviewPublishTab
              product={product}
              issues={issues}
              onSaveDraft={saveDraft}
              onRemoveDraft={removeDraft}
              onDownload={downloadJson}
              savedMessage={savedMessage}
            />
          )}
        </div>

        <div className="mt-12 flex items-center gap-4 border-t border-line pt-6">
          <p className="eyebrow text-stone">
            {errorCount > 0 ? `${errorCount}개의 오류` : '오류 없음'} · {issues.length}개 검증 항목
          </p>
        </div>
      </div>
    </div>
  );
}

function BasicTab({ product, update }: { product: Product; update: <K extends keyof Product>(k: K, v: Product[K]) => void }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Field label="NAME">
        <TextInput
          value={product.name.value ?? ''}
          onChange={(e) =>
            update('name', { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' })
          }
        />
      </Field>
      <Field label="CATEGORY">
        <TextInput
          value={product.category.value ?? ''}
          onChange={(e) =>
            update('category', { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' })
          }
        />
      </Field>
      <Field label="PRICE (KRW)">
        <NumberInput
          value={product.price.value ?? ''}
          onChange={(e) => {
            const n = e.target.value ? Number(e.target.value) : null;
            update('price', { value: n, status: n != null ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' });
          }}
        />
      </Field>
      <Field label="FEATURED ON HOME">
        <label className="flex items-center gap-2 py-2.5 text-sm">
          <input type="checkbox" checked={!!product.featured} onChange={(e) => update('featured', e.target.checked)} />
          홈페이지에 노출
        </label>
      </Field>
      <Field label="SHORT DESCRIPTION" hint="카드/목록에 표시됩니다.">
        <TextInput
          value={product.shortDescription.value ?? ''}
          onChange={(e) =>
            update('shortDescription', {
              value: e.target.value || null,
              status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED',
              source: 'Entered in Product Workspace',
            })
          }
        />
      </Field>
      <Field label="COLORS" hint="쉼표로 구분된 색상 코드, 예: #111110, #d8d6cf">
        <TextInput
          value={product.colors.join(', ')}
          onChange={(e) => update('colors', e.target.value.split(',').map((c) => c.trim()).filter(Boolean))}
        />
      </Field>
      <Field label="DESCRIPTION" hint="">
        <TextArea
          className="sm:col-span-2"
          value={product.description.value ?? ''}
          onChange={(e) =>
            update('description', {
              value: e.target.value || null,
              status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED',
              source: 'Entered in Product Workspace',
            })
          }
        />
      </Field>
      <Field label="STORY">
        <TextArea
          value={product.story.value ?? ''}
          onChange={(e) =>
            update('story', { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' })
          }
        />
      </Field>
      <Field label="LAGI'S VIEW">
        <TextArea
          value={product.lagiSelectionReason.value ?? ''}
          onChange={(e) =>
            update('lagiSelectionReason', {
              value: e.target.value || null,
              status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED',
              source: 'Entered in Product Workspace',
            })
          }
        />
      </Field>
      <Field label="SHOP URL">
        <TextInput
          value={product.shopUrl.value ?? ''}
          onChange={(e) =>
            update('shopUrl', { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' })
          }
        />
      </Field>
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <Field label="WIDTH (CM)">
          <NumberInput
            value={product.dimensions.widthCm ?? ''}
            onChange={(e) => update('dimensions', { ...product.dimensions, widthCm: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="HEIGHT (CM)">
          <NumberInput
            value={product.dimensions.heightCm ?? ''}
            onChange={(e) => update('dimensions', { ...product.dimensions, heightCm: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="DEPTH (CM)">
          <NumberInput
            value={product.dimensions.depthCm ?? ''}
            onChange={(e) => update('dimensions', { ...product.dimensions, depthCm: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
      </div>
    </div>
  );
}

function ImagesTab({ product, update }: { product: Product; update: <K extends keyof Product>(k: K, v: Product[K]) => void }) {
  function handleUpload(e: React.ChangeEvent<HTMLInputElement>, target: 'images' | 'gallery') {
    const files = Array.from(e.target.files ?? []);
    const urls = files.map((f) => URL.createObjectURL(f));
    update(target, [...product[target], ...urls]);
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <p className="eyebrow mb-1">COVER IMAGES</p>
        <p className="mb-4 text-xs text-stone">
          업로드는 이 브라우저에서 미리보기용으로만 동작합니다. 실제 게시를 위해서는 파일을{' '}
          <code>public/products/{product.id}/images/</code>에 추가하고 경로를 입력하세요.
        </p>
        <input type="file" accept="image/*" multiple onChange={(e) => handleUpload(e, 'images')} className="text-sm" />
        <ImageGrid urls={product.images} onRemove={(i) => update('images', product.images.filter((_, idx) => idx !== i))} />
      </div>

      <div>
        <p className="eyebrow mb-4">GALLERY</p>
        <input type="file" accept="image/*" multiple onChange={(e) => handleUpload(e, 'gallery')} className="text-sm" />
        <ImageGrid urls={product.gallery} onRemove={(i) => update('gallery', product.gallery.filter((_, idx) => idx !== i))} />
      </div>
    </div>
  );
}

function ImageGrid({ urls, onRemove }: { urls: string[]; onRemove: (i: number) => void }) {
  if (urls.length === 0) return <p className="mt-4 text-sm text-stone">이미지가 없습니다.</p>;
  return (
    <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {urls.map((u, i) => (
        <div key={i} className="group relative aspect-square bg-mist">
          <img src={u} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute right-1 top-1 bg-ink px-1.5 py-0.5 text-xs text-paper opacity-0 group-hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function ThreeDArTab({ product, update }: { product: Product; update: <K extends keyof Product>(k: K, v: Product[K]) => void }) {
  const [generating, setGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const threeDProvider = getThreeDGenerationProvider();

  function handleModelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const format = modelFormatOf(file);
    if (!format) {
      window.alert('.glb 또는 .gltf 파일만 업로드할 수 있습니다.');
      e.target.value = '';
      return;
    }
    const url = URL.createObjectURL(file);
    update('model3D', url);
    update('model3DAsset', { filename: file.name, format, mimeType: file.type || undefined, url });
    update('threeDAvailable', true);
  }

  async function requestGeneration() {
    setGenerating(true);
    setGenerationMessage(null);
    const result = await threeDProvider.generate({ imageUrls: product.images, prompt: product.name.value ?? product.id, productId: product.id });
    setGenerating(false);
    setGenerationMessage(
      result.status === 'unavailable'
        ? result.errorMessage ?? '3D 생성 서비스가 연결되어 있지 않습니다.'
        : `상태: ${result.status}`
    );
    if (result.modelUrl) {
      update('model3D', result.modelUrl);
      // Generated via a URL, not a local File — clear any stale upload metadata so
      // validation reads this URL's own extension instead of a previous upload's filename.
      update('model3DAsset', undefined);
      update('threeDAvailable', true);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <div>
          <p className="eyebrow mb-2">3D MODEL (GLB)</p>
          <input type="file" accept=".glb,.gltf" onChange={handleModelUpload} className="text-sm" />
          {product.model3DAsset ? (
            <p className="mt-2 text-xs text-stone">
              {product.model3DAsset.filename} · <span className="uppercase">{product.model3DAsset.format}</span>
            </p>
          ) : (
            product.model3D && <p className="mt-2 break-all text-xs text-stone">{product.model3D}</p>
          )}
        </div>

        <div className="border border-dashed border-line p-5">
          <p className="eyebrow mb-2">AI 3D GENERATION (§19-21)</p>
          <p className="mb-3 text-xs text-graphite">
            provider: <code>{threeDProvider.id}</code> · available: <code>{String(threeDProvider.available)}</code>
          </p>
          <button
            type="button"
            onClick={requestGeneration}
            disabled={generating || product.images.length === 0}
            className="eyebrow border border-ink px-4 py-2.5 hover:bg-ink hover:text-paper focus-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating ? '요청 중...' : 'AI로 3D 생성 요청'}
          </button>
          {product.images.length === 0 && <p className="mt-2 text-xs text-stone">먼저 IMAGES 탭에서 사진을 추가하세요.</p>}
          {generationMessage && <p className="mt-3 text-sm text-graphite">{generationMessage}</p>}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={product.threeDAvailable} onChange={(e) => update('threeDAvailable', e.target.checked)} />
            3D 사용 가능으로 게시
          </label>
        </div>

        <hr className="hairline" />

        <div>
          <p className="eyebrow mb-2">AR TARGET (.mind)</p>
          <TextInput
            value={product.arTarget}
            onChange={(e) => update('arTarget', e.target.value)}
            placeholder={`/products/${product.id}/ar/target.mind`}
          />
          <p className="mt-2 text-xs text-stone">
            타겟 이미지를{' '}
            <a href="https://hiukim.github.io/mind-ar-js-doc/tools/compile" target="_blank" rel="noopener noreferrer" className="underline">
              MindAR 이미지 타겟 컴파일러
            </a>
            로 변환한 뒤 위 경로에 배치하세요.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="SCALE">
            <NumberInput
              value={product.arSettings.scale}
              step={0.1}
              onChange={(e) => update('arSettings', { ...product.arSettings, scale: Number(e.target.value) })}
            />
          </Field>
          {(['x', 'y', 'z'] as const).map((axis) => (
            <Field key={axis} label={`POS ${axis.toUpperCase()}`}>
              <NumberInput
                value={product.arSettings.position[axis]}
                step={0.1}
                onChange={(e) =>
                  update('arSettings', { ...product.arSettings, position: { ...product.arSettings.position, [axis]: Number(e.target.value) } })
                }
              />
            </Field>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={product.arAvailable} onChange={(e) => update('arAvailable', e.target.checked)} />
          AR 사용 가능으로 게시
        </label>
      </div>

      <div>
        <p className="eyebrow mb-2">3D PREVIEW</p>
        <ProductViewer
          className="aspect-square w-full"
          modelUrl={product.model3D}
          hotspots={product.hotspots}
          selectedHotspotId={null}
          onSelectHotspot={() => {}}
        />
      </div>
    </div>
  );
}

function HotspotsTab({ product, update }: { product: Product; update: <K extends keyof Product>(k: K, v: Product[K]) => void }) {
  function addHotspot() {
    const h: Hotspot = {
      id: `hotspot-${Date.now().toString().slice(-5)}`,
      title: '',
      category: 'DETAIL',
      position: { x: 0, y: 0, z: 0.3 },
      description: { value: null, status: 'CONTENT_REQUIRED' },
    };
    update('hotspots', [...product.hotspots, h]);
  }

  function updateHotspot(index: number, next: Hotspot) {
    update('hotspots', product.hotspots.map((h, i) => (i === index ? next : h)));
  }

  function removeHotspot(index: number) {
    update('hotspots', product.hotspots.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-6">
      <button type="button" onClick={addHotspot} className="eyebrow w-fit border border-ink px-4 py-2.5 hover:bg-ink hover:text-paper focus-ring">
        + ADD HOTSPOT
      </button>

      {product.hotspots.length === 0 && <p className="text-sm text-stone">등록된 Hotspot이 없습니다.</p>}

      <div className="flex flex-col gap-6">
        {product.hotspots.map((h, i) => (
          <div key={h.id} className="grid grid-cols-1 gap-4 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="TITLE">
              <TextInput value={h.title} onChange={(e) => updateHotspot(i, { ...h, title: e.target.value })} />
            </Field>
            <Field label="CATEGORY">
              <SelectInput value={h.category} onChange={(e) => updateHotspot(i, { ...h, category: e.target.value as HotspotCategory })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <Field key={axis} label={axis.toUpperCase()}>
                  <NumberInput
                    value={h.position[axis]}
                    step={0.05}
                    onChange={(e) => updateHotspot(i, { ...h, position: { ...h.position, [axis]: Number(e.target.value) } })}
                  />
                </Field>
              ))}
            </div>
            <Field label="DESCRIPTION" hint="">
              <TextArea
                className="sm:col-span-2 lg:col-span-3"
                value={h.description.value ?? ''}
                onChange={(e) =>
                  updateHotspot(i, {
                    ...h,
                    description: { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' },
                  })
                }
              />
            </Field>
            <button type="button" onClick={() => removeHotspot(i)} className="eyebrow h-fit self-end border border-line px-4 py-2.5 hover:border-ink focus-ring">
              REMOVE
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaterialProcessTab({ product, update }: { product: Product; update: <K extends keyof Product>(k: K, v: Product[K]) => void }) {
  function addMaterial() {
    const m: MaterialEntry = {
      name: { value: null, status: 'CONTENT_REQUIRED' },
      characteristics: { value: null, status: 'CONTENT_REQUIRED' },
      productLocation: { value: null, status: 'CONTENT_REQUIRED' },
      reasonForUse: { value: null, status: 'CONTENT_REQUIRED' },
    };
    update('materials', [...product.materials, m]);
  }
  function addStep() {
    const s: ProcessStep = { order: product.process.length + 1, title: '', description: { value: null, status: 'CONTENT_REQUIRED' } };
    update('process', [...product.process, s]);
  }

  return (
    <div className="flex flex-col gap-14">
      <div>
        <p className="eyebrow mb-4">MATERIALS</p>
        <button type="button" onClick={addMaterial} className="eyebrow border border-ink px-4 py-2.5 hover:bg-ink hover:text-paper focus-ring">
          + ADD MATERIAL
        </button>
        <div className="mt-5 flex flex-col gap-4">
          {product.materials.map((m, i) => (
            <div key={i} className="grid grid-cols-1 gap-3 border border-line p-4 sm:grid-cols-2">
              <TextInput
                placeholder="Name"
                value={m.name.value ?? ''}
                onChange={(e) => {
                  const list = [...product.materials];
                  list[i] = { ...m, name: { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' } };
                  update('materials', list);
                }}
              />
              <TextInput
                placeholder="Characteristics"
                value={m.characteristics.value ?? ''}
                onChange={(e) => {
                  const list = [...product.materials];
                  list[i] = { ...m, characteristics: { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' } };
                  update('materials', list);
                }}
              />
              <button
                type="button"
                onClick={() => update('materials', product.materials.filter((_, idx) => idx !== i))}
                className="eyebrow w-fit border border-line px-4 py-2 hover:border-ink focus-ring sm:col-span-2"
              >
                REMOVE
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="eyebrow mb-4">PROCESS</p>
        <button type="button" onClick={addStep} className="eyebrow border border-ink px-4 py-2.5 hover:bg-ink hover:text-paper focus-ring">
          + ADD STEP
        </button>
        <div className="mt-5 flex flex-col gap-4">
          {product.process.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-3 border border-line p-4 sm:grid-cols-2">
              <TextInput placeholder="Title" value={s.title} onChange={(e) => {
                const list = [...product.process];
                list[i] = { ...s, title: e.target.value };
                update('process', list);
              }} />
              <TextInput
                placeholder="Description"
                value={s.description.value ?? ''}
                onChange={(e) => {
                  const list = [...product.process];
                  list[i] = { ...s, description: { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' } };
                  update('process', list);
                }}
              />
              <button
                type="button"
                onClick={() => update('process', product.process.filter((_, idx) => idx !== i))}
                className="eyebrow w-fit border border-line px-4 py-2 hover:border-ink focus-ring sm:col-span-2"
              >
                REMOVE
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AIAnalysisTab({ product, update }: { product: Product; update: <K extends keyof Product>(k: K, v: Product[K]) => void }) {
  const provider = getAIProvider();
  const [loading, setLoading] = useState(false);
  const observations = product.imageAnalysis?.observations ?? [];

  async function runAnalysis() {
    setLoading(true);
    const result = await provider.analyzeProductStructure(product.images);
    setLoading(false);
    update('imageAnalysis', { observations: result.observations, analyzedAt: new Date().toISOString() });
  }

  function addManualObservation(level: Observation['level']) {
    const label = window.prompt(`${level} 관찰 내용을 입력하세요`);
    if (!label) return;
    update('imageAnalysis', { observations: [...observations, { level, label }] });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-graphite">
        provider: <code>{provider.id}</code> · available: <code>{String(provider.available)}</code>
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={runAnalysis}
          disabled={loading || product.images.length === 0}
          className="eyebrow border border-ink px-4 py-2.5 hover:bg-ink hover:text-paper focus-ring disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? '분석 중...' : 'AI 이미지 분석 실행'}
        </button>
        {(['OBSERVED', 'INFERRED', 'UNKNOWN'] as const).map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => addManualObservation(lvl)}
            className="eyebrow border border-line px-4 py-2.5 hover:border-ink focus-ring"
          >
            + {lvl}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {observations.length === 0 && <p className="text-sm text-stone">기록된 관찰 내용이 없습니다.</p>}
        {observations.map((o, i) => (
          <div key={i} className="flex items-start gap-3 border-l-2 border-line py-1 pl-4">
            <span className="eyebrow shrink-0 text-stone">{o.level}</span>
            <p className="text-sm text-graphite">{o.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewPublishTab({
  product,
  issues,
  onSaveDraft,
  onRemoveDraft,
  onDownload,
  savedMessage,
}: {
  product: Product;
  issues: ReturnType<typeof validateProduct>;
  onSaveDraft: () => void;
  onRemoveDraft: () => void;
  onDownload: () => void;
  savedMessage: string | null;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow mb-4">VALIDATION</p>
        {issues.length === 0 && <p className="text-sm text-graphite">모든 검사를 통과했습니다.</p>}
        <ul className="flex flex-col gap-2">
          {issues.map((issue, i) => (
            <li key={i} className={`flex items-center gap-2 text-sm ${issue.level === 'error' ? 'text-red-700' : 'text-graphite'}`}>
              <ContentBadge status={issue.level === 'error' ? 'CONTENT_REQUIRED' : 'UNKNOWN'} />
              {issue.message}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-4 border-t border-line pt-6">
        <button type="button" onClick={onSaveDraft} className="eyebrow border border-ink px-6 py-3.5 hover:bg-ink hover:text-paper focus-ring">
          SAVE DRAFT (THIS BROWSER)
        </button>
        <button type="button" onClick={onDownload} className="eyebrow border border-line px-6 py-3.5 hover:border-ink focus-ring">
          DOWNLOAD product.json
        </button>
        <button type="button" onClick={onRemoveDraft} className="eyebrow border border-line px-6 py-3.5 text-stone hover:border-ink focus-ring">
          DELETE DRAFT
        </button>
      </div>
      {savedMessage && <p className="text-sm text-graphite">{savedMessage}</p>}

      <div className="border border-dashed border-line p-5 text-sm text-graphite">
        <p className="eyebrow mb-2">PUBLISH STEPS</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>DOWNLOAD product.json을 클릭합니다.</li>
          <li>
            파일을 <code>public/products/{product.id}/product.json</code>에 저장합니다.
          </li>
          <li>
            이미지/GLB/AR 타겟 파일을 같은 폴더의 <code>images/</code>, <code>model/</code>, <code>ar/</code>에 추가합니다.
          </li>
          <li>
            <code>public/products/manifest.json</code>의 <code>products</code> 배열에 <code>"{product.id}"</code>를 추가합니다.
          </li>
          <li>커밋 후 배포하면 애플리케이션 재빌드 없이 제품이 즉시 노출됩니다.</li>
        </ol>
      </div>

      <div>
        <p className="eyebrow mb-4">LIVE PREVIEW (LOCAL DRAFT)</p>
        <p className="mb-3 text-sm text-stone">SAVE DRAFT 후 아래 페이지에서 데스크톱/3D/AR 미리보기를 확인하세요.</p>
        <div className="flex flex-wrap gap-3">
          <a href={`#/product/${product.id}`} className="eyebrow border border-line px-4 py-2.5 hover:border-ink focus-ring">
            PRODUCT DETAIL →
          </a>
          <a href={`#/ar/${product.id}`} className="eyebrow border border-line px-4 py-2.5 hover:border-ink focus-ring">
            AR PAGE →
          </a>
        </div>
      </div>
    </div>
  );
}
