local function reformatInt(i)
    return tostring(i):reverse():gsub('%d%d%d', '%1,'):reverse():gsub('^,', '')
end

local function pointsCommand(message, args, meta)
    local user = message.mentionedUsers.first or message.author
    local points = meta.db:rowexec('SELECT (points) FROM members WHERE id = ' .. "'" .. user.id .. "'")

    if not points then
        local target = user == message.author and 'You have' or 'That user has'
        return target .. ' no points.'
    end

    local level = math.floor(0.1 * math.sqrt(tonumber(points))) + 1
    local bits = reformatInt(tonumber(points))
    local nextLevel = (level + 1) ^ 2 * 100
    local nextPoints = reformatInt(nextLevel - tonumber(points))
    local target = user == message.author and 'You are' or user.username .. ' is'
    local pronoun = user == message.author and 'You' or 'They'
    return string.format(
        '%s currently level **%d** with **%s** bits.\n%s need **%s** bits for the next level (**%s** more to go!)',
        target,
        level,
        bits,
        pronoun,
        reformatInt(nextLevel),
        nextPoints
    )
end

return {
    run = pointsCommand,
    description = 'Check your current activity points.',
    aliases = { 'balance', 'bal', 'bits', 'profile', 'level' },
    restricted = true,
}
