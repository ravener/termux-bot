local function listAvailableTags(meta)
  local names = {}
  for i, v in ipairs(meta.tags.list) do
    table.insert(names, v.name)
  end
  return table.concat(names, ", ")
end

local function tagCommand(message, args, meta)
  if #args < 1 then
    return "List of available tags:\n\n" .. listAvailableTags(meta)
  end

  local name = args[1]:lower()
  local tag

  for i, v in ipairs(meta.tags.list) do
    if v.name == name then
      tag = v
    else
      for ii, vv in ipairs(v.aliases) do
        if vv == name then
          tag = v
        end
      end
    end
  end

  if not tag then
    -- Return an error message and the full list of tags
    return "Tag not found.\n" .. "List of available tags:\n\n" .. listAvailableTags(meta)
  end

  return table.concat(tag.content, '\n')
end

return {
  run = tagCommand,
  aliases = {"t", "tags"},
  description = "Display a tag, or the list of available tags."
}
