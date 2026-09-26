import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useNavigate } from 'react-router-dom';
import { UiIcon } from '@/components/common/UiIcon';
import { cx } from '@/components/common/cx';
import { useWorld } from '@/context/WorldContext';
import { NAV_SECTIONS } from '@/lib/navigation/sections';
import { setActiveWorldId } from '@/lib/worlds/worldStore';
import { WorldSettingsDialog } from './WorldSettingsDialog';
import styles from './Navigation.module.css';

/** Hamburger button plus the slide-in drawer listing the encyclopedia's sections. */
export function MainMenu() {
  const { world } = useWorld();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault(); // tells the atlas page not to also step back a level
      setOpen(false);
    };
    // Capture phase so this runs before any page-level Escape handler.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  /**
   * Leaves the world and goes back to Home. Only ever changes which world is *active*
   * (`worldStore`); the world itself, and its data, are untouched and stay listed on Home.
   */
  const returnToHome = () => {
    setOpen(false);
    setActiveWorldId(null);
    navigate('/');
  };

  const drawer = (
    <>
      {open && <div className={styles.scrim} onClick={() => setOpen(false)} />}

      <nav id="main-menu" className={cx(styles.drawer, open && styles.drawerOpen)} aria-label="Main" inert={!open}>
        <div className={styles.drawerHeader}>
          <div>
            <p className={styles.drawerTitle}>{world.name}</p>
            {world.tagline && <p className={styles.drawerTagline}>{world.tagline}</p>}
          </div>
          <button ref={closeRef} type="button" className={styles.iconButton} onClick={() => setOpen(false)} aria-label="Close menu">
            <UiIcon name="close" />
          </button>
        </div>

        <ul className={styles.menuList}>
          {NAV_SECTIONS.map((section) => (
            <li key={section.id}>
              {section.enabled ? (
                <NavLink
                  to={section.path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => cx(styles.menuItem, isActive && styles.menuItemActive)}
                >
                  <span className={styles.menuText}>
                    <span className={styles.menuLabel}>{section.label}</span>
                    <span className={styles.menuDescription}>{section.description}</span>
                  </span>
                </NavLink>
              ) : (
                <span className={cx(styles.menuItem, styles.menuItemDisabled)} aria-disabled="true">
                  <span className={styles.menuText}>
                    <span className={styles.menuLabel}>{section.label}</span>
                    <span className={styles.menuDescription}>{section.description}</span>
                  </span>
                  <span className={styles.soon}>Soon</span>
                </span>
              )}
            </li>
          ))}
        </ul>

        <div className={styles.menuFooter}>
          <button
            type="button"
            className={styles.footerButton}
            onClick={() => {
              setOpen(false);
              setSettingsOpen(true);
            }}
          >
            <UiIcon name="palette" />
            <span className={styles.footerLabel}>World Settings</span>
          </button>
          <button type="button" className={styles.footerButton} onClick={returnToHome}>
            <UiIcon name="home" />
            <span className={styles.footerLabel}>Return to Home</span>
          </button>
        </div>
      </nav>
    </>
  );

  return (
    <>
      <button
        type="button"
        className={styles.menuButton}
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="main-menu"
      >
        <UiIcon name="menu" />
      </button>

      {/*
        Portalled to <body>: the header pill uses backdrop-filter, which makes it the
        containing block for position:fixed descendants and would clip the drawer
        to the pill's rectangle.
      */}
      {createPortal(drawer, document.body)}
      <WorldSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
