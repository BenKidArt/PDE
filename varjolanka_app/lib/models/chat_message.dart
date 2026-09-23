import 'package:flutter/material.dart';

enum MessageBadge { bot, mask }

class ChatMessage {
  const ChatMessage({
    required this.author,
    required this.text,
    required this.time,
    this.badge = MessageBadge.mask,
    this.badgeColor,
    this.isAi = false,
  });

  final String author;
  final String text;
  final String time;
  final MessageBadge badge;
  final Color? badgeColor;
  final bool isAi;
}

class DmBubble {
  const DmBubble({
    required this.author,
    required this.text,
    required this.isMe,
  });

  final String author;
  final String text;
  final bool isMe;
}
