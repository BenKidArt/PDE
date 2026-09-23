import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Tarrojen valintalaatikko — valitaan valmiiksi kuratoidusta kirjastosta,
/// EI vapaata kuvalatausta (ks. docs/foorumi-konsepti.md → GIF/tarrapäätös:
/// vapaa kuvalataus = CSAM/laittoman sisällön riski, siksi vain kuratoitu
/// valikoima on sallittu).
class StickerTray extends StatelessWidget {
  const StickerTray({super.key, required this.onPicked});

  final ValueChanged<String> onPicked;

  static const _stickers = [
    ('Flamingo', 'assets/images/flamingo.jpg'),
  ];

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('// TARRAT — valitse, ei lataa omia',
                style: TextStyle(color: AppColors.inkDim, fontSize: 12)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: _stickers
                  .map(
                    (s) => GestureDetector(
                      onTap: () => onPicked(s.$1),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.asset(
                          s.$2,
                          width: 64,
                          height: 64,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      ),
    );
  }
}
