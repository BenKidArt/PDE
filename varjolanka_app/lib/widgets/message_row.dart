import 'package:flutter/material.dart';
import '../models/chat_message.dart';
import '../theme/app_theme.dart';

class MessageRow extends StatelessWidget {
  const MessageRow({
    super.key,
    required this.message,
    required this.onReport,
    this.onAddFriend,
  });

  final ChatMessage message;
  final VoidCallback onReport;
  final VoidCallback? onAddFriend;

  @override
  Widget build(BuildContext context) {
    final badgeColor = message.badgeColor ?? AppColors.rose;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: badgeColor.withOpacity(0.15),
            child: Icon(
              message.isAi ? Icons.smart_toy_outlined : Icons.masks_outlined,
              size: 18,
              color: badgeColor,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      message.author,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    if (message.isAi) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          border: Border.all(color: AppColors.rose),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: const Text('AI 12H',
                            style: TextStyle(
                                fontSize: 10, color: AppColors.rose)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(message.text,
                    style: Theme.of(context).textTheme.bodyMedium),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Text(message.time,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: AppColors.inkDim)),
                    const Spacer(),
                    if (onAddFriend != null)
                      TextButton(
                        onPressed: onAddFriend,
                        child: const Text('+ Kaveriksi'),
                      ),
                    TextButton(
                      onPressed: onReport,
                      child: const Text('Ilmoita'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
