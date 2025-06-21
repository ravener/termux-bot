local cp = require('childprocess')
local fs = require('fs')
local json = require('json')

local function reloadTagsCommand(msg, args, meta)
    cp.exec(
        'git pull',
        coroutine.wrap(function(err, stdout, stderr)
            local results = ''

            if err then results = string.format('**Error**\n```\n%s```', pp.strip(pp.dump(err))) end

            if #stdout > 0 then results = results .. string.format('\n**stdout**\n```\n%s```', stdout) end

            if #stderr > 0 then results = results .. string.format('\n**stderr**\n```%s```', stderr) end

            if #results > 0 then
                if #results > 1990 then results = results:sub(1, 1990) end

                msg:reply(results)
            else
                msg:reply('No Results returned.')
            end

            -- If the pull was successful, reload the tags.
            if not err then meta.tags.list = json.decode(fs.readFileSync('data/tags.json')) end
        end)
    )
end

return {
    run = reloadTagsCommand,
    aliases = { 'rtags' },
    description = 'Updates the tags database',
    restricted = true,
    adminOnly = true,
}
