local function helpCommand(message, args, meta)
    local help = '= Commands =\n\n'
    local commands = {}

    for k, v in pairs(meta.commands) do
        if not v.ownerOnly or v.ownerOnly and message.author.id == meta.config.owner then
            if not v.adminOnly or v.adminOnly and meta.isAdmin then
                local description = v.description or 'No Description Provided.'
                help = help .. k:pad(12) .. ':: ' .. description .. '\n'
            end
        end
    end

    return string.format('```asciidoc\n%s```', help)
end

return {
    run = helpCommand,
    description = 'Get help about a command.',
}
