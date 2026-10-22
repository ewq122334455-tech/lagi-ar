import { Link } from 'react-router-dom';
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

const TAB_LABELS: Record<Tab, string> = {
  BASIC: '1. 기본 정보',
  IMAGES: '2. 사진',
  '3D & AR': '3. 3D',
  HOTSPOTS: '4. 디테일 포인트',
  'MATERIAL & PROCESS': '5. 소재 · 공정',
  'AI ANALYSIS': '6. 메모 · 분석',
  'PREVIEW & PUBLISH': '7. 미리보기 · 게시',
};

const CATEGORIES: HotspotCategory[] = ['MATERIAL', 'DETAIL', 'CRAFT', 'PROCESS', 'STRUCTURE', 'FUNCTION'];
const CATEGORY_LABELS: Record<HotspotCategory, string> = {
  MATERIAL: '소재',
  DETAIL: '디테일',
  CRAFT: '만듦새',
  PROCESS: '공정',
  STRUCTURE: '구조',
  FUNCTION: '기능',
};
const LEVEL_LABELS: Record<Observation['level'], string> = {
  OBSERVED: '확인된 사실',
  INFERRED: '추정',
  UNKNOWN: '모름',
};

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
        <p className="eyebrow">관리자 전용</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] lg:text-4xl">제품 등록</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-graphite">
          탭 순서대로 채우면 됩니다. 입력한 내용은 <strong>7. 미리보기 · 게시</strong>에서 “임시 저장”하면 이 브라우저에서
          바로 미리볼 수 있고, 실제 사이트에 올리려면 거기서 제품 파일(product.json)을 내려받아 GitHub에 올리면 됩니다.
          (방문자에게는 보이지 않는 페이지입니다.)
        </p>
        <Link to="/cutouts" className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
          카메라 피팅용 실사 누끼 만들기 →
        </Link>

        {/* PRODUCT SELECTOR */}
        <div className="mt-10 flex flex-wrap items-end gap-4 border-y border-line py-6">
          <Field label="제품 ID" hint="영문 소문자·숫자·하이픈만 (예: product-002)">
            <TextInput
              value={product.id}
              onChange={(e) => update('id', e.target.value.trim())}
              placeholder="product-002"
            />
          </Field>
          <Field label="기존 제품 불러오기">
            <SelectInput onChange={(e) => e.target.value && loadExisting(e.target.value)} defaultValue="">
              <option value="" disabled>
                선택...
              </option>
              {publishedIds.map((id) => (
                <option key={id} value={id}>
                  {id} (게시됨)
                </option>
              ))}
              {draftIds.map((id) => (
                <option key={id} value={id}>
                  {id} (임시 저장)
                </option>
              ))}
            </SelectInput>
          </Field>
          <button
            type="button"
            onClick={() => setProduct(createEmptyProduct(`product-${Date.now().toString().slice(-4)}`))}
            className="eyebrow border border-line px-4 py-2.5 hover:border-ink focus-ring"
          >
            + 새 제품
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
              {TAB_LABELS[t]}
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
            {errorCount > 0 ? `고쳐야 할 항목 ${errorCount}개` : '필수 항목 문제 없음'} · 확인 항목 {issues.length}개
          </p>
        </div>
      </div>
    </div>
  );
}

function BasicTab({ product, update }: { product: Product; update: <K extends keyof Product>(k: K, v: Product[K]) => void }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <Field label="제품명">
        <TextInput
          value={product.name.value ?? ''}
          onChange={(e) =>
            update('name', { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' })
          }
        />
      </Field>
      <Field label="카테고리" hint="예: 토트백, 크로스백">
        <TextInput
          value={product.category.value ?? ''}
          onChange={(e) =>
            update('category', { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' })
          }
        />
      </Field>
      <Field label="가격 (원)" hint="숫자만 (예: 59000)">
        <NumberInput
          value={product.price.value ?? ''}
          onChange={(e) => {
            const n = e.target.value ? Number(e.target.value) : null;
            update('price', { value: n, status: n != null ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' });
          }}
        />
      </Field>
      <Field label="홈 노출">
        <label className="flex items-center gap-2 py-2.5 text-sm">
          <input type="checkbox" checked={!!product.featured} onChange={(e) => update('featured', e.target.checked)} />
          홈 화면 “Featured”에 보이기
        </label>
      </Field>
      <Field label="한 줄 소개" hint="제품 목록 카드에 표시됩니다.">
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
      <Field label="색상" hint="색상 코드를 쉼표로 구분 (예: #111110, #d8d6cf)">
        <TextInput
          value={product.colors.join(', ')}
          onChange={(e) => update('colors', e.target.value.split(',').map((c) => c.trim()).filter(Boolean))}
        />
      </Field>
      <Field label="상세 설명" hint="">
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
      <Field label="제품 이야기" hint="이 제품이 만들어진 배경">
        <TextArea
          value={product.story.value ?? ''}
          onChange={(e) =>
            update('story', { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' })
          }
        />
      </Field>
      <Field label="LAGI가 고른 이유">
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
      <Field label="구매 링크" hint="네이버 스마트스토어 상품 주소">
        <TextInput
          value={product.shopUrl.value ?? ''}
          onChange={(e) =>
            update('shopUrl', { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' })
          }
        />
      </Field>
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <Field label="가로 (cm)">
          <NumberInput
            value={product.dimensions.widthCm ?? ''}
            onChange={(e) => update('dimensions', { ...product.dimensions, widthCm: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="세로 (cm)">
          <NumberInput
            value={product.dimensions.heightCm ?? ''}
            onChange={(e) => update('dimensions', { ...product.dimensions, heightCm: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
        <Field label="폭 (cm)">
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
        <p className="eyebrow mb-1">대표 사진</p>
        <p className="mb-4 text-xs text-stone">
          여기서 올린 사진은 이 브라우저 미리보기용입니다. 실제 사이트에 올리려면 사진 파일을 GitHub의{' '}
          <code>public/products/{product.id}/images/</code> 폴더에 올려야 합니다.
        </p>
        <input type="file" accept="image/*" multiple onChange={(e) => handleUpload(e, 'images')} className="text-sm" />
        <ImageGrid urls={product.images} onRemove={(i) => update('images', product.images.filter((_, idx) => idx !== i))} />
      </div>

      <div>
        <p className="eyebrow mb-4">추가 사진 (갤러리)</p>
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
          <p className="eyebrow mb-2">3D 모델 파일 (.glb)</p>
          <p className="mb-3 text-xs leading-relaxed text-stone">
            .glb는 제품을 360° 돌려볼 수 있는 3D 파일입니다(Tripo·Meshy 같은 AI 3D 생성 툴이나 3D 프로그램에서 내보냄).
            파일을 고르면 오른쪽에서 바로 미리볼 수 있습니다. 실제 사이트에 올리려면 파일을 GitHub의{' '}
            <code>public/products/{product.id}/model/</code> 폴더에 올리고, 아래 칸에 그 경로를 적으세요.
            10MB가 넘는 파일은 휴대폰에서 느리니 줄여서 올리는 것을 권장합니다.
          </p>
          <input type="file" accept=".glb,.gltf" onChange={handleModelUpload} className="text-sm" />
          <TextInput
            className="mt-3 w-full"
            value={product.model3D.startsWith('blob:') ? '' : product.model3D}
            onChange={(e) => {
              update('model3D', e.target.value.trim());
              update('model3DAsset', undefined);
            }}
            placeholder={`products/${product.id}/model/bag.glb`}
          />
          {product.model3DAsset && (
            <p className="mt-2 text-xs text-stone">
              미리보기 중: {product.model3DAsset.filename} · <span className="uppercase">{product.model3DAsset.format}</span>
            </p>
          )}
        </div>

        <div className="border border-dashed border-line p-5">
          <p className="eyebrow mb-2">AI로 3D 만들기 (서버 연결 필요)</p>
          <p className="mb-3 text-xs text-graphite">
            {threeDProvider.available ? '연결됨' : '아직 3D 생성 서버가 연결되어 있지 않아 사용할 수 없습니다.'}
          </p>
          <button
            type="button"
            onClick={requestGeneration}
            disabled={generating || product.images.length === 0}
            className="eyebrow border border-ink px-4 py-2.5 hover:bg-ink hover:text-paper focus-ring disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating ? '요청 중...' : 'AI로 3D 생성 요청'}
          </button>
          {product.images.length === 0 && <p className="mt-2 text-xs text-stone">먼저 ‘2. 사진’ 탭에서 사진을 추가하세요.</p>}
          {generationMessage && <p className="mt-3 text-sm text-graphite">{generationMessage}</p>}
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={product.threeDAvailable} onChange={(e) => update('threeDAvailable', e.target.checked)} />
            사이트에 3D 보기 켜기
          </label>
        </div>

      </div>

      <div>
        <p className="eyebrow mb-2">3D 미리보기</p>
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
        + 디테일 포인트 추가
      </button>
      <p className="max-w-2xl text-xs leading-relaxed text-stone">
        3D 모델 위에 동그란 점으로 표시되고, 누르면 설명이 열리는 포인트입니다(예: 지퍼, 손잡이). 위치(X 좌우 · Y 높이 · Z
        앞뒤)는 ‘3. 3D’ 탭 미리보기를 보면서 숫자를 조금씩 바꿔 맞추세요.
      </p>

      {product.hotspots.length === 0 && <p className="text-sm text-stone">등록된 포인트가 없습니다.</p>}

      <div className="flex flex-col gap-6">
        {product.hotspots.map((h, i) => (
          <div key={h.id} className="grid grid-cols-1 gap-4 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="이름">
              <TextInput value={h.title} onChange={(e) => updateHotspot(i, { ...h, title: e.target.value })} />
            </Field>
            <Field label="종류">
              <SelectInput value={h.category} onChange={(e) => updateHotspot(i, { ...h, category: e.target.value as HotspotCategory })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <Field key={axis} label={`${axis.toUpperCase()} (${axis === 'x' ? '좌우' : axis === 'y' ? '높이' : '앞뒤'})`}>
                  <NumberInput
                    value={h.position[axis]}
                    step={0.05}
                    onChange={(e) => updateHotspot(i, { ...h, position: { ...h.position, [axis]: Number(e.target.value) } })}
                  />
                </Field>
              ))}
            </div>
            <Field label="설명" hint="">
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
              삭제
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
        <p className="eyebrow mb-4">소재</p>
        <button type="button" onClick={addMaterial} className="eyebrow border border-ink px-4 py-2.5 hover:bg-ink hover:text-paper focus-ring">
          + 소재 추가
        </button>
        <div className="mt-5 flex flex-col gap-4">
          {product.materials.map((m, i) => (
            <div key={i} className="grid grid-cols-1 gap-3 border border-line p-4 sm:grid-cols-2">
              <TextInput
                placeholder="소재 이름 (예: 캔버스)"
                value={m.name.value ?? ''}
                onChange={(e) => {
                  const list = [...product.materials];
                  list[i] = { ...m, name: { value: e.target.value || null, status: e.target.value ? 'VERIFIED' : 'CONTENT_REQUIRED', source: 'Entered in Product Workspace' } };
                  update('materials', list);
                }}
              />
              <TextInput
                placeholder="특징 (예: 가볍고 튼튼함)"
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
        <p className="eyebrow mb-4">만드는 과정</p>
        <button type="button" onClick={addStep} className="eyebrow border border-ink px-4 py-2.5 hover:bg-ink hover:text-paper focus-ring">
          + 단계 추가
        </button>
        <div className="mt-5 flex flex-col gap-4">
          {product.process.map((s, i) => (
            <div key={i} className="grid grid-cols-1 gap-3 border border-line p-4 sm:grid-cols-2">
              <TextInput placeholder="단계 이름 (예: 재단)" value={s.title} onChange={(e) => {
                const list = [...product.process];
                list[i] = { ...s, title: e.target.value };
                update('process', list);
              }} />
              <TextInput
                placeholder="설명"
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
    const label = window.prompt(`${LEVEL_LABELS[level]} 내용을 입력하세요`);
    if (!label) return;
    update('imageAnalysis', { observations: [...observations, { level, label }] });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-graphite">
        제품에 대해 확인된 사실과 추정을 구분해서 적어두는 메모입니다. 사이트에는 표시되지 않습니다.
        {!provider.available && ' (AI 이미지 분석 서버는 아직 연결되어 있지 않습니다.)'}
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
            + {LEVEL_LABELS[lvl]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {observations.length === 0 && <p className="text-sm text-stone">기록된 관찰 내용이 없습니다.</p>}
        {observations.map((o, i) => (
          <div key={i} className="flex items-start gap-3 border-l-2 border-line py-1 pl-4">
            <span className="eyebrow shrink-0 text-stone">{LEVEL_LABELS[o.level]}</span>
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
        <p className="eyebrow mb-4">확인 항목</p>
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
          임시 저장 (이 브라우저)
        </button>
        <button type="button" onClick={onDownload} className="eyebrow border border-line px-6 py-3.5 hover:border-ink focus-ring">
          제품 파일 내려받기 (product.json)
        </button>
        <button type="button" onClick={onRemoveDraft} className="eyebrow border border-line px-6 py-3.5 text-stone hover:border-ink focus-ring">
          임시 저장 삭제
        </button>
      </div>
      {savedMessage && <p className="text-sm text-graphite">{savedMessage}</p>}

      <div className="border border-dashed border-line p-5 text-sm text-graphite">
        <p className="eyebrow mb-2">실제 사이트에 올리는 방법</p>
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>위의 <strong>제품 파일 내려받기</strong>를 누릅니다.</li>
          <li>
            GitHub 저장소에서 <code>public/products/{product.id}/</code> 폴더를 열고 <em>Add file → Upload files</em>로
            받은 <code>product.json</code>을 올립니다(같은 이름의 파일이 있으면 덮어씁니다).
          </li>
          <li>
            사진·3D 파일을 같은 폴더 안의 <code>images/</code>, <code>model/</code> 폴더에 올립니다.
          </li>
          <li>
            새 제품이면 <code>public/products/manifest.json</code>의 목록에 <code>"{product.id}"</code>를 추가합니다.
          </li>
          <li>커밋하면 1~2분 뒤 사이트에 자동으로 반영됩니다.</li>
        </ol>
      </div>

      <div>
        <p className="eyebrow mb-4">미리보기</p>
        <p className="mb-3 text-sm text-stone">‘임시 저장’ 후 아래 버튼으로 실제 화면처럼 확인할 수 있습니다.</p>
        <div className="flex flex-wrap gap-3">
          <a href={`#/product/${product.id}`} className="eyebrow border border-line px-4 py-2.5 hover:border-ink focus-ring">
            제품 페이지 →
          </a>
          <a href={`#/ai-fit/${product.id}`} className="eyebrow border border-line px-4 py-2.5 hover:border-ink focus-ring">
            AI 피팅 →
          </a>
        </div>
      </div>
    </div>
  );
}
