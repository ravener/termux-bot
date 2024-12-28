local cp = require("childprocess")
local pp = require("pretty-print")

local function execCommand(msg, args, meta)
  local arg = meta.rawArgs:gsub('```\n?', '') -- strip markdown codeblocks

  cp.exec(arg, coroutine.wrap(function (err, stdout, stderr)
    local results = ""

    if err then
      results = string.format("**Error**\n```\n%s```", pp.strip(pp.dump(err)))
    end

    if #stdout > 0 then
      results = results .. string.format("\n**stdout**\n```\n%s```", stdout)
    end

    if #stderr > 0 then
      results = results .. string.format("\n**stderr**\n```%s```", stderr)
    end

    if #results > 0 then
      if #results > 1990 then
        results = results:sub(1, 1990)
      end
        
      msg:reply(results)
    else
      msg:reply("No Results returned.")
    end
  end))
end

return {
  run = execCommand,
  aliases = {"shell"},
  ownerOnly = true,
  description = "Executes commandline code.",
  disabled = true
}
