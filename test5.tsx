import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

const html = renderToStaticMarkup(
  React.createElement(ReactMarkdown, {
    rehypePlugins: [rehypeRaw],
    components: {
      details: (props: any) => {
        console.log("details props:", Object.keys(props), props.open);
        return React.createElement('div', { className: 'custom-details' }, props.children);
      }
    }
  }, '<details open><summary>Title</summary>\n\n**Bold** text\n</details>')
);
console.log(html);
