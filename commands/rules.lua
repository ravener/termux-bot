local function rulesCommand(message, args, meta)
    local channel = message.guild:getChannel('641258254051180564')
    local rules = channel:getLastMessage()

    if #args < 1 then
        if not rules then
            return 'No Rules Found.'
        else
            if not rules.embeds then return 'Malformed rules message.' end
            return string.format('```\n%s```', rules.embeds[1].description)
        end
    end

    local content = meta.rawArgs

    if #content > 1990 then return 'Content is too long to fit, you silly nitro user.' end

    if not rules then
        assert(channel:send({
            embed = {
                title = 'Server Rules',
                color = 0xFFFFFF,
                description = content,
            },
        }))

        return 'Successfully sent the rules.'
    end

    assert(rules:update({
        embed = {
            title = 'Server Rules',
            color = 0xFFFFFF,
            description = content,
        },
    }))

    return 'Successfully updated the rules.'
end

return {
    run = rulesCommand,
    description = 'Changes the server rules.',
    adminOnly = true,
    guildOnly = true,
    restricted = true,
}
