import 'package:flutter/material.dart';
import '../services/moderation_service.dart';
import '../theme/app_theme.dart';
import 'sticker_tray.dart';

/// Kirjoituskenttä + tarranappi. Taso 1 -suodatin ajetaan tässä ennen
/// lähetystä — kova esto asiakaspuolella nopeuttaa palautetta käyttäjälle,
/// mutta ei korvaa palvelinpuolen tarkistusta (ks. docs/foorumi-konsepti.md
/// → "2b. Tekstisuodatus": asiakas ei ole luotettu).
class ComposeBar extends StatefulWidget {
  const ComposeBar({
    super.key,
    required this.hintText,
    required this.onSend,
  });

  final String hintText;
  final ValueChanged<String> onSend;

  @override
  State<ComposeBar> createState() => _ComposeBarState();
}

class _ComposeBarState extends State<ComposeBar> {
  final _controller = TextEditingController();
  String? _blockedReason;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleSend() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    final hits = ModerationService.matches(text);
    if (hits.isNotEmpty) {
      setState(() => _blockedReason = 'Estetty — sisältää: ${hits.join(', ')}');
      return;
    }
    setState(() => _blockedReason = null);
    widget.onSend(text);
    _controller.clear();
  }

  void _openStickers() {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.panel,
      builder: (_) => StickerTray(
        onPicked: (label) {
          Navigator.of(context).pop();
          widget.onSend('[tarra: $label]');
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_blockedReason != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(_blockedReason!,
                style: const TextStyle(color: AppColors.danger, fontSize: 12)),
          ),
        Row(
          children: [
            IconButton(
              onPressed: _openStickers,
              icon: const Icon(Icons.emoji_emotions_outlined),
              color: AppColors.pink,
            ),
            Expanded(
              child: TextField(
                controller: _controller,
                decoration: InputDecoration(hintText: widget.hintText),
                onSubmitted: (_) => _handleSend(),
              ),
            ),
            IconButton(
              onPressed: _handleSend,
              icon: const Icon(Icons.send),
              color: AppColors.pink,
            ),
          ],
        ),
      ],
    );
  }
}
