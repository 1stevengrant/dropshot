-- Code files uploaded before code drops existed were stored as notes or files. Reclassify them by extension
-- and swap their automatic type tag. index.html objects are short link redirects, so they stay links.
-- Tags are updated first, while the drops still have their old kind.
INSERT OR IGNORE INTO drop_tags (drop_id, tag)
SELECT DISTINCT drop_id, 'code' FROM drop_tags
WHERE tag IN ('note', 'file')
  AND drop_id IN (
    SELECT id FROM drops
    WHERE kind IN ('text', 'file')
      AND filename <> 'index.html'
      AND instr(filename, '.') > 0
      AND lower(replace(filename, rtrim(filename, replace(filename, '.', '')), '')) IN ('js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts', 'html', 'htm', 'xml', 'css', 'scss', 'json', 'php', 'py', 'rb', 'go', 'rs', 'swift', 'kt', 'kts', 'java', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'cs', 'dart', 'ex', 'exs', 'lua', 'pl', 'pm', 'r', 'sh', 'bash', 'zsh', 'sql', 'graphql', 'gql', 'yaml', 'yml', 'toml', 'ini', 'conf', 'dockerfile', 'mk', 'diff', 'patch')
  );

DELETE FROM drop_tags
WHERE tag IN ('note', 'file')
  AND drop_id IN (
    SELECT id FROM drops
    WHERE kind IN ('text', 'file')
      AND filename <> 'index.html'
      AND instr(filename, '.') > 0
      AND lower(replace(filename, rtrim(filename, replace(filename, '.', '')), '')) IN ('js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts', 'html', 'htm', 'xml', 'css', 'scss', 'json', 'php', 'py', 'rb', 'go', 'rs', 'swift', 'kt', 'kts', 'java', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'cs', 'dart', 'ex', 'exs', 'lua', 'pl', 'pm', 'r', 'sh', 'bash', 'zsh', 'sql', 'graphql', 'gql', 'yaml', 'yml', 'toml', 'ini', 'conf', 'dockerfile', 'mk', 'diff', 'patch')
  );

UPDATE drops SET kind = 'code'
WHERE kind IN ('text', 'file')
  AND filename <> 'index.html'
  AND instr(filename, '.') > 0
  AND lower(replace(filename, rtrim(filename, replace(filename, '.', '')), '')) IN ('js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts', 'html', 'htm', 'xml', 'css', 'scss', 'json', 'php', 'py', 'rb', 'go', 'rs', 'swift', 'kt', 'kts', 'java', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hh', 'cs', 'dart', 'ex', 'exs', 'lua', 'pl', 'pm', 'r', 'sh', 'bash', 'zsh', 'sql', 'graphql', 'gql', 'yaml', 'yml', 'toml', 'ini', 'conf', 'dockerfile', 'mk', 'diff', 'patch');
