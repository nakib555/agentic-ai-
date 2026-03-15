import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';

const html = renderToStaticMarkup(
  React.createElement(ReactMarkdown, {
    rehypePlugins: [rehypeRaw],
    components: {
      details: (props: any) => {
        console.log("details children types:", React.Children.toArray(props.children).map(c => (c as any).type));
        console.log("details children node tagNames:", React.Children.toArray(props.children).map(c => (c as any).props?.node?.tagName));
        return React.createElement('div', { className: 'custom-details' }, props.children);
      }
    }
  }, '<details><summary>Title</summary>\n\n**Bold** text\n</details>')
);
console.log(html);
