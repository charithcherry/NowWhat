const fs = require('fs');
const path = require('path');

const files = [
  'c:/Users/achin/Github/What_Now/nutrition-wellness/src/components/Navigation.tsx',
  'c:/Users/achin/Github/What_Now/skin-hair-analysis/src/components/Navigation.tsx',
  'c:/Users/achin/Github/What_Now/nutrition-yelp/frontend/src/components/Navigation.tsx',
  'c:/Users/achin/Github/What_Now/community/frontend/src/components/Navigation.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // 1. Add useEffect
  content = content.replace('import { useState } from "react";', 'import { useState, useEffect } from "react";');

  // 2. Remove static menuItems and place them inside the component dynamically
  const menuMatch = content.match(/const menuItems = \[([\s\S]*?)\];/);
  if (!menuMatch) { console.log(`Could not find menuItems in ${file}`); continue; }
  
  let dynamicMenu = menuMatch[0].replace('http://localhost:3000/fitness', '`${urls.base}/fitness`')
                                .replace(/http:\/\/localhost:3000/g, 'urls.base')
                                .replace(/http:\/\/localhost:3004/g, 'urls.yelp')
                                .replace(/http:\/\/localhost:3002/g, 'urls.skin')
                                .replace(/http:\/\/localhost:3003/g, 'urls.nutrition')
                                .replace(/http:\/\/localhost:3006/g, 'urls.community')
                                .replace(/href: "\/([^\"]+)"/g, 'href: urls.$1');
  
  dynamicMenu = dynamicMenu.replace(/href: "([^"]+)"/g, 'href: $1'); // Remove quotes around url variables

  content = content.replace(menuMatch[0], ''); // Remove static

  const urlsHook = `
  const [urls, setUrls] = useState({
    base: "http://localhost:3000",
    nutrition: "http://localhost:3003",
    yelp: "http://localhost:3004",
    skin: "http://localhost:3002",
    community: "http://localhost:3006"
  });

  useEffect(() => {
    fetch('/api/config', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setUrls(prev => ({...prev, ...data})))
      .catch(console.error);
  }, []);

  ${dynamicMenu}
  
  const getHrefWrapper = (urlPattern) => \`/api/sso?target=\${encodeURIComponent(urlPattern)}\`;
`;

  content = content.replace('export function Navigation({ user }: NavigationProps) {\n  const [isOpen, setIsOpen] = useState(false);', 'export function Navigation({ user }: NavigationProps) {\n' + urlsHook + '\n  const [isOpen, setIsOpen] = useState(false);');

  // Replace links
  content = content.replace(/href="http:\/\/localhost:(\d+)(\/[^"]*)?"/g, (match, port, route) => {
    let urlVar = port === '3000' ? 'urls.base' : 
                 port === '3002' ? 'urls.skin' : 
                 port === '3003' ? 'urls.nutrition' : 
                 port === '3004' ? 'urls.yelp' : 'urls.community';
    let fullVar = route ? `\`\${${urlVar}}${route}\`` : urlVar;
    return `href={getHrefWrapper(${fullVar})}`;
  });

  content = content.replace(/href=\{item\.href\}/g, `href={getHrefWrapper(item.href)}`);
  
  // Replace window.location
  content = content.replace(/window\.location\.href = "http:\/\/localhost:3000";/g, 'window.location.href = urls.base;');
  
  // Replace fetch inside logout
  content = content.replace(/fetch\("http:\/\/localhost:3000\/api\/auth\/logout"/g, 'fetch(`${urls.base}/api/auth/logout`');

  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
