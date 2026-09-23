import 'package:flutter/material.dart';
import '../models/chat_message.dart';
import '../theme/app_theme.dart';
import '../widgets/compose_bar.dart';

/// Kaverit & yksityisviestit. Viestit avautuvat vasta kun molemmat
/// nimimerkit ovat hyväksyneet toisensa. TODO(firebase): DM-sisältö
/// salataan päästä päähän (ks. docs/foorumi-konsepti.md → "2c. Päästä
/// päähän -salaus") — palvelin näkee vain metatiedon, ei viestin sisältöä.
class FriendsScreen extends StatefulWidget {
  const FriendsScreen({super.key});

  @override
  State<FriendsScreen> createState() => _FriendsScreenState();
}

class _FriendsScreenState extends State<FriendsScreen> {
  final List<DmBubble> _bubbles = [
    const DmBubble(
      author: 'Metsästäjä77',
      text: 'Näitkö tän viestin julkisessa chatissa?',
      isMe: false,
    ),
    const DmBubble(
      author: 'sinä',
      text: 'Näin, lähetin jo kaveripyynnön',
      isMe: true,
    ),
  ];

  void _send(String text) {
    setState(() {
      _bubbles.add(DmBubble(author: 'sinä', text: text, isMe: true));
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('// KAVERIT & YKSITYISVIESTIT',
              style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          Expanded(
            child: ListView.builder(
              itemCount: _bubbles.length,
              itemBuilder: (context, i) {
                final b = _bubbles[i];
                return Align(
                  alignment:
                      b.isMe ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.all(10),
                    constraints: const BoxConstraints(maxWidth: 280),
                    decoration: BoxDecoration(
                      color: b.isMe ? AppColors.pinkDim : AppColors.panel,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(b.author,
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.inkDim)),
                        Text(b.text),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          ComposeBar(hintText: 'Kirjoita yksityisviesti…', onSend: _send),
        ],
      ),
    );
  }
}
