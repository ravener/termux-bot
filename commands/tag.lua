local fs = require('fs')

local function tagCommand(message, args, meta)
  if #args < 1 then
    local names = {}
    for i, v in ipairs(meta.tags) do
      table.insert(names, v.name)
    end

    return "List of available tags:\n\n" .. table.concat(names, ", ")
  end

  local name = args[1]:lower()
  local tag
  
  for i, v in ipairs(meta.tags) do
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
    return "Tag not found."
  end

  return table.concat(tag.content, '\n')
end

return {
  run = tagCommand,
  aliases = {"t", "tags"},
  description = "Display a tag."
}
