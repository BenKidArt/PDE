import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'chat_screen.dart';
import 'friends_screen.dart';
import 'settings_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.nickname});

  final String nickname;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final screens = [
      ChatScreen(nickname: widget.nickname),
      const FriendsScreen(),
      const SettingsScreen(),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('VARJOLANKA'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                widget.nickname,
                style: const TextStyle(color: AppColors.inkDim, fontSize: 12),
              ),
            ),
          ),
        ],
      ),
      body: IndexedStack(index: _index, children: screens),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: const [
          BottomNavigationBarItem(
              icon: Icon(Icons.forum_outlined), label: 'CHAT'),
          BottomNavigationBarItem(
              icon: Icon(Icons.people_outline), label: 'KAVERIT'),
          BottomNavigationBarItem(
              icon: Icon(Icons.settings_outlined), label: 'ASETUKSET'),
        ],
      ),
    );
  }
}
