import { UiIcon } from '@/components/common/UiIcon';
import { cx } from '@/components/common/cx';
import styles from './Map.module.css';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  /** Present only when the world defines a reference image to trace. */
  reference?: { visible: boolean; onToggle: () => void };
}

export function MapControls({ onZoomIn, onZoomOut, onRecenter, reference }: MapControlsProps) {
  return (
    <div className={styles.controls} role="group" aria-label="Map controls">
      <button type="button" onClick={onZoomIn} aria-label="Zoom in" title="Zoom in">
        <UiIcon name="plus" />
      </button>
      <button type="button" onClick={onZoomOut} aria-label="Zoom out" title="Zoom out">
        <UiIcon name="minus" />
      </button>
      <button type="button" onClick={onRecenter} aria-label="Recenter map" title="Recenter on current selection">
        <UiIcon name="recenter" />
      </button>
      {reference && (
        <button
          type="button"
          className={cx(reference.visible && styles.controlActive)}
          onClick={reference.onToggle}
          aria-pressed={reference.visible}
          aria-label="Toggle reference image"
          title="Show or hide the reference image"
        >
          <UiIcon name="image" />
        </button>
      )}
    </div>
  );
}
