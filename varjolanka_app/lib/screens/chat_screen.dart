import 'package:flutter/material.dart';
import '../models/chat_message.dart';
import '../theme/app_theme.dart';
import '../widgets/compose_bar.dart';
import '../widgets/message_row.dart';

/// Julkinen chat. Viestit ovat toistaiseksi paikallista mock-dataa —
/// TODO(firebase): korvaa Firestore-streamillä (public_chat/messages,
/// järjestys createdAt) kun oikea projekti on olemassa.
class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.nickname});

  final String nickname;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final List<ChatMessage> _messages = [
    const ChatMessage(
      author: 'uutispoiminta',
      text: 'Hallituksen budjettiriihi alkaa tänään — lähde: '
          'esimerkkiuutinen.fi/budjettiriihi-2026',
      time: 'KLO 08:00',
      isAi: true,
      badgeColor: AppColors.rose,
    ),
    const ChatMessage(
      author: 'Nimetön_42',
      text: 'Odotan mielenkiinnolla mitä tästä tulee, seurataanko täällä '
          'suoraa lähetystä?',
      time: 'KLO 08:14',
    ),
    const ChatMessage(
      author: 'Kahvinjuoja99',
      text: 'Linkki lähetykseen löytyy tuosta AI-poiminnan lähdeviitteestä.',
      time: 'KLO 08:19',
      badgeColor: AppColors.purple,
    ),
    const ChatMessage(
      author: 'Sivustakatsoja',
      text: 'Mitä mieltä olette kuntavaaliehdokkaista tänä vuonna?',
      time: 'KLO 08:26',
      badgeColor: AppColors.lilac,
    ),
  ];

  void _report(String author) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Ilmoitus vastaanotettu: $author')),
    );
  }

  void _addFriend(String author) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Kaveripyyntö lähetetty: $author')),
    );
  }

  void _send(String text) {
    setState(() {
      _messages.add(ChatMessage(
        author: widget.nickname,
        text: text,
        time: 'NYT',
      ));
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('// JULKINEN CHAT — VIIMEISIMMÄT',
                  style: TextStyle(fontSize: 12, color: AppColors.inkDim)),
              Text('UUSIN ▾',
                  style: TextStyle(fontSize: 12, color: AppColors.inkDim)),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _messages.length,
            itemBuilder: (context, i) {
              final m = _messages[i];
              return MessageRow(
                message: m,
                onReport: () => _report(m.author),
                onAddFriend:
                    m.isAi ? null : () => _addFriend(m.author),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: ComposeBar(hintText: 'Kirjoita viesti…', onSend: _send),
        ),
      ],
    );
  }
}
