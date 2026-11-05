
defmodule ModderGuardInspector do
  @allowed_extensions [".geode", ".zip"]
  @max_file_size 100 * 1024 * 1024
  @max_archive_entries 5000
  @max_entry_size 25 * 1024 * 1024
  @max_total_uncompressed_size 100 * 1024 * 1024

  def inspect_file(file_path) do
    extension =
      file_path
      |> Path.extname()
      |> String.downcase()

    cond do
      extension not in @allowed_extensions ->
        {:error, "Unsupported file extension"}

      not File.regular?(file_path) ->
        {:error, "File does not exist or is not a regular file"}

      true ->
        inspect_valid_file(file_path, extension)
    end
  end

  defp inspect_valid_file(file_path, extension) do
    case File.stat(file_path) do
      {:ok, stat} ->
        cond do
          stat.size == 0 ->
            {:error, "File is empty"}

          stat.size > @max_file_size ->
            {:error, "File exceeds the 100 MB size limit"}

          extension == ".zip" ->
            inspect_zip(file_path, stat)

          extension == ".geode" ->
            inspect_geode(file_path, stat)
        end

      {:error, _reason} ->
        {:error, "Could not read file information"}
    end
  end

  defp inspect_zip(file_path, stat) do
    case File.open(file_path, [:read, :binary]) do
      {:ok, file} ->
        signature = IO.binread(file, 4)
        File.close(file)

        if valid_zip_signature?(signature) do
          inspect_zip_directory(file_path, stat)
        else
          {:error, "Invalid ZIP file signature"}
        end

      {:error, _reason} ->
        {:error, "Could not read ZIP file"}
    end
  end

  defp valid_zip_signature?(signature) do
    signature in [
      <<0x50, 0x4B, 0x03, 0x04>>,
      <<0x50, 0x4B, 0x05, 0x06>>,
      <<0x50, 0x4B, 0x07, 0x08>>
    ]
  end

  defp inspect_zip_directory(file_path, stat) do
    case :zip.list_dir(String.to_charlist(file_path)) do
      {:ok, entries} ->
        file_entries =
          Enum.reject(entries, fn
            {:zip_comment, _} -> true
            _ -> false
          end)

        entry_count = length(file_entries)

        sizes =
  Enum.map(file_entries, fn
    {:zip_file, _name, file_info, _comment, _offset, _comp_size}
    when is_tuple(file_info) and tuple_size(file_info) >= 2 ->
      if elem(file_info, 0) == :file_info do
        elem(file_info, 1)
      else
        -1
      end

    _ ->
      -1
  end)

        total_size = Enum.sum(sizes)

        cond do
          entry_count > @max_archive_entries ->
            {:error, "Archive contains too many entries"}

          Enum.any?(sizes, &(&1 < 0)) ->
            {:error, "Archive contains invalid entry metadata"}

          Enum.any?(sizes, &(&1 > @max_entry_size)) ->
            {:error, "An archive entry exceeds the 25 MB limit"}

          total_size > @max_total_uncompressed_size ->
            {:error, "Archive exceeds the 100 MB expanded size limit"}

          true ->
            {:ok,
             Map.merge(
               file_info(file_path, stat, "zip_directory_valid"),
               %{
                 archive_entries: entry_count,
                 archive_directory_checked: true,
                 uncompressed_size_bytes: total_size
               }
             )}
        end

      {:error, _reason} ->
        {:error, "ZIP archive directory is invalid or unreadable"}
    end
  end

  defp inspect_geode(file_path, stat) do
    {:ok, file_info(file_path, stat, "pending_geode_format_validation")}
  end

  defp file_info(file_path, stat, status) do
    %{
      filename: Path.basename(file_path),
      extension: Path.extname(file_path),
      size_bytes: stat.size,
      status: status,
      executed: false
    }
  end
end
