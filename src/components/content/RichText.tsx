import { useMemo, type ComponentProps } from 'react';
import Markdown, { defaultUrlTransform, type Options } from 'react-markdown';
import { cx } from '@/components/common/cx';
import { useWorld } from '@/context/WorldContext';
import { EntityLink } from './EntityLink';
import { remarkEntityLinks } from './remarkEntityLinks';
import styles from './Content.module.css';

const ENTITY_PROTOCOL = 'entity:';

// react-markdown removes URLs it doesn't recognise, so let our own scheme through.
const urlTransform: NonNullable<Options['urlTransform']> = (url) =>
  url.startsWith(ENTITY_PROTOCOL) ? url : defaultUrlTransform(url);

const components: NonNullable<Options['components']> = {
  a: ({ href, children }: ComponentProps<'a'>) =>
    href?.startsWith(ENTITY_PROTOCOL) ? (
      <EntityLink id={href.slice(ENTITY_PROTOCOL.length)}>{children}</EntityLink>
    ) : (
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    ),
  // The page already has its title; a "# Heading" in lore is a section.
  h1: ({ children }: ComponentProps<'h1'>) => <h2>{children}</h2>,
};

interface RichTextProps {
  markdown: string;
  /** The entity this text belongs to, so it doesn't link to itself. */
  selfId?: string;
  className?: string;
}

/**
 * Renders Markdown, with mentions of other entities turned into links. Used for
 * every piece of prose in the app (summaries, long-form content), so links
 * behave the same everywhere.
 */
export function RichText({ markdown, selfId, className }: RichTextProps) {
  const index = useWorld();
  const plugins = useMemo(
    () => [[remarkEntityLinks, { resolver: index.links, selfId }]] as unknown as NonNullable<Options['remarkPlugins']>,
    [index, selfId],
  );

  return (
    <div className={cx(styles.prose, className)}>
      <Markdown remarkPlugins={plugins} urlTransform={urlTransform} components={components}>
        {markdown}
      </Markdown>
    </div>
  );
}
