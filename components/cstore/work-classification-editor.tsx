"use client";

import { type FormEvent, useId, useMemo, useState } from "react";
import {
  Box,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  Layers3,
  MapPin,
  Wrench,
} from "lucide-react";

import styles from "./setup-workflows.module.css";
import type {
  ClassifiableWorkOrder,
  ClassificationAsset,
  ClassificationCategory,
  ClassificationComponent,
  ClassificationStore,
  ClassificationTaxonomyNode,
  WorkClassificationValue,
} from "./setup-workflows";

export interface WorkClassificationEditorProps {
  workOrder: ClassifiableWorkOrder;
  store: ClassificationStore;
  categories: ClassificationCategory[];
  taxonomyNodes: ClassificationTaxonomyNode[];
  assets: ClassificationAsset[];
  components: ClassificationComponent[];
  onSave: (value: WorkClassificationValue) => void | Promise<void>;
  initialValue?: Partial<Omit<WorkClassificationValue, "workOrderId">>;
  className?: string;
  isSaving?: boolean;
}

function buildTaxonomyLabel(
  node: ClassificationTaxonomyNode,
  byId: Map<string, ClassificationTaxonomyNode>,
) {
  const labels = [node.label];
  const visited = new Set([node.id]);
  let parentId = node.parentId;

  while (parentId && !visited.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    visited.add(parent.id);
    labels.unshift(parent.label);
    parentId = parent.parentId;
  }

  return labels.join(" › ");
}

function buildComponentLabel(
  component: ClassificationComponent,
  byId: Map<string, ClassificationComponent>,
) {
  const labels = [component.name];
  const visited = new Set([component.id]);
  let parentId = component.parentComponentId;

  while (parentId && !visited.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    visited.add(parent.id);
    labels.unshift(parent.name);
    parentId = parent.parentComponentId;
  }

  return labels.join(" › ");
}

export function WorkClassificationEditor({
  workOrder,
  store,
  categories,
  taxonomyNodes,
  assets,
  components,
  onSave,
  initialValue,
  className,
  isSaving: savingFromParent = false,
}: WorkClassificationEditorProps) {
  const formId = useId();
  const [categoryId, setCategoryId] = useState(
    initialValue?.categoryId ?? workOrder.categoryId ?? "",
  );
  const [taxonomyNodeId, setTaxonomyNodeId] = useState(
    initialValue?.taxonomyNodeId ?? workOrder.taxonomyNodeId ?? "",
  );
  const [assetId, setAssetId] = useState(initialValue?.assetId ?? workOrder.assetId ?? "");
  const [componentId, setComponentId] = useState(
    initialValue?.componentId ?? workOrder.componentId ?? "",
  );
  const [localSaving, setLocalSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const isSaving = savingFromParent || localSaving;
  const storeMismatch = workOrder.storeId !== store.id;

  const availableCategories = useMemo(() => {
    const activeIds = new Set(store.activeCategoryIds);
    return [...categories]
      .filter((category) => activeIds.has(category.id) || category.id === categoryId)
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }, [categories, store.activeCategoryIds, categoryId]);

  const taxonomyById = useMemo(
    () => new Map(taxonomyNodes.map((node) => [node.id, node])),
    [taxonomyNodes],
  );

  const availableTaxonomyNodes = useMemo(
    () =>
      taxonomyNodes
        .filter((node) => node.categoryId === categoryId)
        .sort((left, right) => {
          const orderDifference = left.sortOrder - right.sortOrder;
          return orderDifference || left.label.localeCompare(right.label);
        }),
    [categoryId, taxonomyNodes],
  );

  const availableAssets = useMemo(
    () =>
      assets
        .filter((asset) => {
          if (asset.storeId !== store.id || asset.categoryId !== categoryId) return false;
          if (asset.status === "retired" && asset.id !== assetId) return false;
          if (!taxonomyNodeId) return true;
          return (
            asset.taxonomyNodeId === taxonomyNodeId ||
            asset.taxonomyPathIds.includes(taxonomyNodeId)
          );
        })
        .sort((left, right) => left.name.localeCompare(right.name)),
    [assetId, assets, categoryId, store.id, taxonomyNodeId],
  );

  const componentById = useMemo(
    () => new Map(components.map((component) => [component.id, component])),
    [components],
  );

  const availableComponents = useMemo(
    () =>
      components
        .filter(
          (component) =>
            component.assetId === assetId &&
            (component.status !== "replaced" || component.id === componentId),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [assetId, componentId, components],
  );

  const currentCategory = categories.find((category) => category.id === categoryId);
  const currentTaxonomy = taxonomyById.get(taxonomyNodeId);
  const currentAsset = assets.find((asset) => asset.id === assetId);
  const currentComponent = componentById.get(componentId);
  const completedLevel = componentId ? 4 : assetId ? 3 : taxonomyNodeId ? 2 : categoryId ? 1 : 0;

  function changeCategory(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setTaxonomyNodeId("");
    setAssetId("");
    setComponentId("");
    setSavedMessage(null);
  }

  function changeTaxonomy(nextTaxonomyNodeId: string) {
    setTaxonomyNodeId(nextTaxonomyNodeId);
    setAssetId("");
    setComponentId("");
    setSavedMessage(null);
  }

  function changeAsset(nextAssetId: string) {
    setAssetId(nextAssetId);
    setComponentId("");
    setSavedMessage(null);
  }

  async function persist(classificationDeferred: boolean) {
    setError(null);
    setSavedMessage(null);

    if (storeMismatch) {
      setError("This work order belongs to a different store. Classification was not changed.");
      return;
    }
    if (!classificationDeferred && !categoryId) {
      setError("Choose a service category, or keep classification deferred for later.");
      return;
    }

    try {
      setLocalSaving(true);
      await onSave({
        workOrderId: workOrder.id,
        ...(categoryId ? { categoryId } : {}),
        ...(taxonomyNodeId ? { taxonomyNodeId } : {}),
        ...(assetId ? { assetId } : {}),
        ...(componentId ? { componentId } : {}),
        classificationDeferred,
      });
      setSavedMessage(
        classificationDeferred
          ? "Current classification saved. Deeper details remain open for later."
          : "Classification saved.",
      );
    } catch {
      setError("The classification could not be saved. The work order was not changed.");
    } finally {
      setLocalSaving(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void persist(false);
  }

  return (
    <form
      className={[styles.root, styles.surface, className].filter(Boolean).join(" ")}
      onSubmit={handleSubmit}
      noValidate
    >
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Work order {workOrder.number}</span>
          <h2>Classify the work</h2>
          <p>
            Link the service record to the right maintenance level. Stop wherever the known
            facts stop—no placeholder equipment is required.
          </p>
        </div>
        <span className={styles.headerPill}>
          <Layers3 aria-hidden="true" /> Level {completedLevel} of 4
        </span>
      </header>

      <div className={styles.classificationContext}>
        <div className={styles.workSummary}>
          <strong>{workOrder.title}</strong>
          <span>{workOrder.problemDescription}</span>
        </div>
        <div className={styles.storeChip}>
          <Building2 aria-hidden="true" />
          <span>
            Store {store.storeNumber} · {store.name}
          </span>
        </div>
      </div>

      {storeMismatch ? (
        <div className={styles.warning} role="alert">
          <CircleAlert aria-hidden="true" />
          <span>
            This work order is not assigned to the supplied store. Select the correct store
            record before editing its classification.
          </span>
        </div>
      ) : null}

      <div className={styles.classificationBody}>
        <div className={styles.progressSteps} aria-label="Classification progress">
          {["Category", "Group or type", "Asset", "Component"].map((label, index) => (
            <div
              key={label}
              className={`${styles.progressStep} ${
                completedLevel > index ? styles.progressStepComplete : ""
              }`}
            >
              <span>{completedLevel > index ? <Check aria-hidden="true" /> : index + 1}</span>
              <strong>{label}</strong>
              {index < 3 ? <ChevronRight aria-hidden="true" /> : null}
            </div>
          ))}
        </div>

        <div className={styles.classificationGrid}>
          <div className={styles.classificationField}>
            <label htmlFor={`${formId}-category`}>
              <span className={styles.fieldIcon}>
                <Wrench aria-hidden="true" /> 1
              </span>
              Service category
            </label>
            <select
              id={`${formId}-category`}
              value={categoryId}
              onChange={(event) => changeCategory(event.target.value)}
              disabled={storeMismatch || isSaving}
            >
              <option value="">Not classified yet</option>
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
            <small>
              {currentCategory?.description ??
                "Choose the broad service area, such as Refrigeration or HVAC."}
            </small>
          </div>

          <div className={styles.classificationField}>
            <label htmlFor={`${formId}-taxonomy`}>
              <span className={styles.fieldIcon}>
                <Layers3 aria-hidden="true" /> 2
              </span>
              Group or equipment type
            </label>
            <select
              id={`${formId}-taxonomy`}
              value={taxonomyNodeId}
              onChange={(event) => changeTaxonomy(event.target.value)}
              disabled={!categoryId || storeMismatch || isSaving}
            >
              <option value="">{categoryId ? "Keep at category level" : "Choose a category first"}</option>
              {availableTaxonomyNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {buildTaxonomyLabel(node, taxonomyById)}
                </option>
              ))}
            </select>
            <small>
              {categoryId && availableTaxonomyNodes.length === 0
                ? "No groups are configured here yet. Category-level classification is valid."
                : currentTaxonomy
                  ? `${currentTaxonomy.kind.replace("_", " ")} selected`
                  : "Narrow the record only when the equipment family is known."}
            </small>
          </div>

          <div className={styles.classificationField}>
            <label htmlFor={`${formId}-asset`}>
              <span className={styles.fieldIcon}>
                <Box aria-hidden="true" /> 3
              </span>
              Store asset
            </label>
            <select
              id={`${formId}-asset`}
              value={assetId}
              onChange={(event) => changeAsset(event.target.value)}
              disabled={!categoryId || storeMismatch || isSaving}
            >
              <option value="">
                {categoryId ? "No asset linked yet" : "Choose a category first"}
              </option>
              {availableAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetCode} · {asset.name}
                </option>
              ))}
            </select>
            <small>
              {categoryId && availableAssets.length === 0
                ? "No matching assets are set up at this store. You can finish later."
                : currentAsset
                  ? `${currentAsset.locationDetail} · ${currentAsset.status.replaceAll("_", " ")}`
                  : `Only equipment assigned to Store ${store.storeNumber} appears here.`}
            </small>
          </div>

          <div className={styles.classificationField}>
            <label htmlFor={`${formId}-component`}>
              <span className={styles.fieldIcon}>
                <MapPin aria-hidden="true" /> 4
              </span>
              Component <span className={styles.optional}>(optional)</span>
            </label>
            <select
              id={`${formId}-component`}
              value={componentId}
              onChange={(event) => {
                setComponentId(event.target.value);
                setSavedMessage(null);
              }}
              disabled={!assetId || storeMismatch || isSaving}
            >
              <option value="">{assetId ? "Whole asset" : "Choose an asset first"}</option>
              {availableComponents.map((component) => (
                <option key={component.id} value={component.id}>
                  {buildComponentLabel(component, componentById)} · {component.componentCode}
                </option>
              ))}
            </select>
            <small>
              {assetId && availableComponents.length === 0
                ? "No components are recorded for this asset. Whole-asset classification is complete."
                : currentComponent
                  ? `${currentComponent.componentCode} selected`
                  : "Use this only when the exact subassembly is known."}
            </small>
          </div>
        </div>

        <div className={styles.classificationTrail} aria-label="Current classification">
          <span>Current path</span>
          <strong>{currentCategory?.label ?? "Unclassified"}</strong>
          {currentTaxonomy ? (
            <>
              <ChevronRight aria-hidden="true" />
              <strong>{currentTaxonomy.label}</strong>
            </>
          ) : null}
          {currentAsset ? (
            <>
              <ChevronRight aria-hidden="true" />
              <strong>{currentAsset.name}</strong>
            </>
          ) : null}
          {currentComponent ? (
            <>
              <ChevronRight aria-hidden="true" />
              <strong>{currentComponent.name}</strong>
            </>
          ) : null}
        </div>

        <div className={styles.deferPanel}>
          <div>
            <strong>Not sure of the exact equipment?</strong>
            <span>
              Save the level you know and keep deeper classification open. The work order
              remains usable, searchable, and ready for service.
            </span>
          </div>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => void persist(true)}
            disabled={storeMismatch || isSaving}
          >
            {isSaving ? "Saving…" : "Save current level & finish later"}
          </button>
        </div>
      </div>

      <footer className={styles.footer}>
        <div className={styles.feedback} aria-live="polite">
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : savedMessage ? (
            <p className={styles.success}>
              <Check aria-hidden="true" /> {savedMessage}
            </p>
          ) : (
            <span>Changing classification does not change who is assigned to the work.</span>
          )}
        </div>
        <button
          className={styles.primaryButton}
          type="submit"
          disabled={storeMismatch || isSaving}
        >
          {isSaving ? "Saving…" : "Save classification"}
        </button>
      </footer>
    </form>
  );
}
