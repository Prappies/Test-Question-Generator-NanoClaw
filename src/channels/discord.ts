import { Client, Events, GatewayIntentBits, Message, TextChannel, REST, Routes, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import { registerChannel, ChannelOpts } from './registry.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

export interface DiscordChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

export class DiscordChannel implements Channel {
  name = 'discord';

  private client: Client | null = null;
  private opts: DiscordChannelOpts;
  private botToken: string;
  private pendingInteractions: Map<string, ChatInputCommandInteraction> = new Map();

  constructor(botToken: string, opts: DiscordChannelOpts) {
    this.botToken = botToken;
    this.opts = opts;
  }

  async connect(): Promise<void> {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ],
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      // Ignore bot messages (including own)
      if (message.author.bot) return;

      const channelId = message.channelId;
      const chatJid = `dc:${channelId}`;
      let content = message.content;
      const timestamp = message.createdAt.toISOString();
      const senderName =
        message.member?.displayName ||
        message.author.displayName ||
        message.author.username;
      const sender = message.author.id;
      const msgId = message.id;

      // Determine chat name
      let chatName: string;
      if (message.guild) {
        const textChannel = message.channel as TextChannel;
        chatName = `${message.guild.name} #${textChannel.name}`;
      } else {
        chatName = senderName;
      }

      // Translate Discord @bot mentions into TRIGGER_PATTERN format.
      // Discord mentions look like <@botUserId> — these won't match
      // TRIGGER_PATTERN (e.g., ^@Andy\b), so we prepend the trigger
      // when the bot is @mentioned.
      if (this.client?.user) {
        const botId = this.client.user.id;
        const isBotMentioned =
          message.mentions.users.has(botId) ||
          content.includes(`<@${botId}>`) ||
          content.includes(`<@!${botId}>`);

        if (isBotMentioned) {
          // Strip the <@botId> mention to avoid visual clutter
          content = content
            .replace(new RegExp(`<@!?${botId}>`, 'g'), '')
            .trim();
          // Prepend trigger if not already present
          if (!TRIGGER_PATTERN.test(content)) {
            content = `@${ASSISTANT_NAME} ${content}`;
          }
        }
      }

      // Handle attachments — store placeholders so the agent knows something was sent
      if (message.attachments.size > 0) {
        const attachmentDescriptions = [...message.attachments.values()].map((att) => {
          const contentType = att.contentType || '';
          if (contentType.startsWith('image/')) {
            return `[Image: ${att.name || 'image'}]`;
          } else if (contentType.startsWith('video/')) {
            return `[Video: ${att.name || 'video'}]`;
          } else if (contentType.startsWith('audio/')) {
            return `[Audio: ${att.name || 'audio'}]`;
          } else {
            return `[File: ${att.name || 'file'}]`;
          }
        });
        if (content) {
          content = `${content}\n${attachmentDescriptions.join('\n')}`;
        } else {
          content = attachmentDescriptions.join('\n');
        }
      }

      // Handle reply context — include who the user is replying to
      if (message.reference?.messageId) {
        try {
          const repliedTo = await message.channel.messages.fetch(
            message.reference.messageId,
          );
          const replyAuthor =
            repliedTo.member?.displayName ||
            repliedTo.author.displayName ||
            repliedTo.author.username;
          content = `[Reply to ${replyAuthor}] ${content}`;
        } catch {
          // Referenced message may have been deleted
        }
      }

      // Store chat metadata for discovery
      const isGroup = message.guild !== null;
      this.opts.onChatMetadata(chatJid, timestamp, chatName, 'discord', isGroup);

      // Only deliver full message for registered groups
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        logger.debug(
          { chatJid, chatName },
          'Message from unregistered Discord channel',
        );
        return;
      }

      // Deliver message — startMessageLoop() will pick it up
      this.opts.onMessage(chatJid, {
        id: msgId,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
        discord_user_id: sender, // Pass Discord user ID for OAuth
      });

      logger.info(
        { chatJid, chatName, sender: senderName },
        'Discord message stored',
      );
    });

    // Handle errors gracefully
    this.client.on(Events.Error, (err) => {
      logger.error({ err: err.message }, 'Discord client error');
    });

    // Handle slash commands
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const commandInteraction = interaction as ChatInputCommandInteraction;
      const channelId = commandInteraction.channelId;
      const chatJid = `dc:${channelId}`;
      const timestamp = new Date().toISOString();
      const senderName =
        commandInteraction.member && 'displayName' in commandInteraction.member
          ? (commandInteraction.member.displayName as string)
          : commandInteraction.user.displayName || commandInteraction.user.username;
      const sender = commandInteraction.user.id;
      const msgId = commandInteraction.id;

      // Determine chat name
      let chatName: string;
      if (commandInteraction.guild) {
        const textChannel = commandInteraction.channel as TextChannel;
        chatName = `${commandInteraction.guild.name} #${textChannel?.name || 'unknown'}`;
      } else {
        chatName = senderName;
      }

      // Convert slash command to message content
      let content = '';
      if (commandInteraction.commandName === 'login') {
        content = `@${ASSISTANT_NAME} /login`;
      } else if (commandInteraction.commandName === 'quiz') {
        const url = commandInteraction.options.getString('url');
        content = url ? `@${ASSISTANT_NAME} /quiz ${url}` : `@${ASSISTANT_NAME} /quiz`;
      }

      // Acknowledge the interaction immediately (ephemeral = only visible to user)
      await commandInteraction.deferReply({ flags: 64 }); // 64 = MessageFlags.Ephemeral

      // Store the interaction by channel ID so we can reply to it later
      this.pendingInteractions.set(channelId, commandInteraction);

      // Clean up after 15 minutes (Discord interaction token expires after 15 min)
      setTimeout(() => {
        this.pendingInteractions.delete(channelId);
      }, 15 * 60 * 1000);

      // Store chat metadata
      const isGroup = commandInteraction.guild !== null;
      this.opts.onChatMetadata(chatJid, timestamp, chatName, 'discord', isGroup);

      // Only deliver for registered groups
      const group = this.opts.registeredGroups()[chatJid];
      if (!group) {
        await commandInteraction.editReply('This channel is not registered with NanoClaw.');
        this.pendingInteractions.delete(channelId);
        return;
      }

      // Deliver message
      this.opts.onMessage(chatJid, {
        id: msgId,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
        discord_user_id: sender, // Pass Discord user ID for OAuth
      });

      logger.info(
        { chatJid, chatName, sender: senderName, command: commandInteraction.commandName },
        'Discord slash command stored',
      );
    });

    return new Promise<void>((resolve) => {
      this.client!.once(Events.ClientReady, async (readyClient) => {
        logger.info(
          { username: readyClient.user.tag, id: readyClient.user.id },
          'Discord bot connected',
        );
        console.log(`\n  Discord bot: ${readyClient.user.tag}`);
        console.log(
          `  Use /chatid command or check channel IDs in Discord settings\n`,
        );

        // Register slash commands
        await this.registerSlashCommands(readyClient.user.id);

        resolve();
      });

      this.client!.login(this.botToken);
    });
  }

  private async registerSlashCommands(clientId: string): Promise<void> {
    const commands = [
      new SlashCommandBuilder()
        .setName('login')
        .setDescription('Set up your Google account for quiz generation'),
      new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Generate a quiz from a URL or PDF')
        .addStringOption(option =>
          option.setName('url')
            .setDescription('URL to generate quiz from (or upload PDF as attachment)')
            .setRequired(false)
        ),
    ].map(command => command.toJSON());

    const rest = new REST().setToken(this.botToken);

    try {
      logger.info('Registering Discord slash commands...');
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      logger.info('Discord slash commands registered successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to register Discord slash commands');
    }
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.client) {
      logger.warn('Discord client not initialized');
      return;
    }

    try {
      const channelId = jid.replace(/^dc:/, '');

      // Check if this is a response to a slash command
      const pendingInteraction = this.pendingInteractions.get(channelId);

      if (pendingInteraction) {
        // Reply to the slash command interaction
        const MAX_LENGTH = 2000;
        if (text.length <= MAX_LENGTH) {
          await pendingInteraction.editReply(text);
        } else {
          // First message via editReply, then follow-ups
          await pendingInteraction.editReply(text.slice(0, MAX_LENGTH));
          for (let i = MAX_LENGTH; i < text.length; i += MAX_LENGTH) {
            await pendingInteraction.followUp(text.slice(i, i + MAX_LENGTH));
          }
        }
        this.pendingInteractions.delete(channelId);
        logger.info({ jid, length: text.length }, 'Discord slash command reply sent');
        return;
      }

      // Normal message (not a slash command response)
      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !('send' in channel)) {
        logger.warn({ jid }, 'Discord channel not found or not text-based');
        return;
      }

      const textChannel = channel as TextChannel;

      // Discord has a 2000 character limit per message — split if needed
      const MAX_LENGTH = 2000;
      if (text.length <= MAX_LENGTH) {
        await textChannel.send(text);
      } else {
        for (let i = 0; i < text.length; i += MAX_LENGTH) {
          await textChannel.send(text.slice(i, i + MAX_LENGTH));
        }
      }
      logger.info({ jid, length: text.length }, 'Discord message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send Discord message');
    }
  }

  isConnected(): boolean {
    return this.client !== null && this.client.isReady();
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('dc:');
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      logger.info('Discord bot stopped');
    }
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (!this.client || !isTyping) return;
    try {
      const channelId = jid.replace(/^dc:/, '');
      const channel = await this.client.channels.fetch(channelId);
      if (channel && 'sendTyping' in channel) {
        await (channel as TextChannel).sendTyping();
      }
    } catch (err) {
      logger.debug({ jid, err }, 'Failed to send Discord typing indicator');
    }
  }
}

registerChannel('discord', (opts: ChannelOpts) => {
  const envVars = readEnvFile(['DISCORD_BOT_TOKEN']);
  const token =
    process.env.DISCORD_BOT_TOKEN || envVars.DISCORD_BOT_TOKEN || '';
  if (!token) {
    logger.warn('Discord: DISCORD_BOT_TOKEN not set');
    return null;
  }
  return new DiscordChannel(token, opts);
});
