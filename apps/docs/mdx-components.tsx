import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import * as TabsComponents from 'fumadocs-ui/components/tabs';
import { APIReference, APIResponse, CodeSample, SDKInstall } from './components/code-samples';

// use this function to get MDX components, you will need it for rendering MDX
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...TabsComponents,
    // Custom code sample components
    APIReference,
    APIResponse,
    CodeSample,
    SDKInstall,
    ...components,
  };
}
